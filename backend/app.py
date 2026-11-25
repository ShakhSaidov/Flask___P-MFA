import os
import time
from collections import defaultdict, deque
from pathlib import Path
from threading import Lock
from typing import Any, Dict, Optional, Tuple

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory

from .llm_service import (
    LLMServiceError,
    analyze_assignment,
    get_active_provider,
    run_student_checkin,
)
from .pii_guard import mask_pii
from .pmfa_framework import (
    ARENE_TIERS,
    EVIDENCE_FORMAT_OPTIONS,
    MAX_SHORT_LEN,
    MAX_TEXT_LEN,
    PMFA_FACTORS,
    SAMPLE_ASSIGNMENTS,
    validate_and_render_blueprint,
    validate_assignment_inputs,
    validate_checkpoint,
)

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

STATIC_DIST_DIR = BASE_DIR / "static_dist"


class SimpleRateLimiter:
    """Lightweight process-local per-IP sliding-window protection for demo API calls."""

    def __init__(self, max_requests: int = 30, window_seconds: int = 3600, max_tracked_ips: int = 5000):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.max_tracked_ips = max(1, max_tracked_ips)
        self._hits: Dict[str, deque] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = time.time()
        with self._lock:
            q = self._hits.get(key)
            if q is None and len(self._hits) >= self.max_tracked_ips:
                stale_keys = [
                    ip for ip, dq in self._hits.items()
                    if not dq or (now - dq[-1] > self.window_seconds)
                ]
                for ip in stale_keys:
                    del self._hits[ip]
                while len(self._hits) >= self.max_tracked_ips:
                    oldest_ip = min(
                        self._hits,
                        key=lambda ip: self._hits[ip][-1] if self._hits[ip] else 0.0,
                    )
                    del self._hits[oldest_ip]
            if q is None:
                q = self._hits[key]

            while q and now - q[0] > self.window_seconds:
                q.popleft()
            if len(q) >= self.max_requests:
                return False
            q.append(now)
            return True


rate_limiter = SimpleRateLimiter(max_requests=30, window_seconds=3600)


def _get_json_dict() -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    if not request.data or not request.data.strip():
        return {}, None
    body = request.get_json(silent=True)
    if body is None:
        return None, "Request body must be valid JSON."
    if not isinstance(body, dict):
        return None, "Request body must be a JSON object."
    return body, None


def _get_str_field(body: Dict[str, Any], key: str) -> Tuple[str, Optional[str]]:
    val = body.get(key)
    if val is None:
        return "", None
    if not isinstance(val, str):
        return "", f"Field '{key}' must be a string."
    return val.strip(), None


def _parse_assignment_inputs(body: Dict[str, Any]) -> Tuple[Optional[Dict[str, str]], Optional[str]]:
    raw: Dict[str, str] = {}
    for key in ("title", "learning_outcomes", "assignment_text", "arene_tier", "custom_ai_rules"):
        val, err = _get_str_field(body, key)
        if err:
            return None, err
        raw[key] = val

    try:
        return (
            validate_assignment_inputs(
                title=raw["title"],
                learning_outcomes=raw["learning_outcomes"],
                assignment_text=raw["assignment_text"],
                arene_tier=raw["arene_tier"],
                custom_ai_rules=raw["custom_ai_rules"],
            ),
            None,
        )
    except ValueError as exc:
        return None, str(exc)


def _mask_field_map(fields: Dict[str, str]) -> Tuple[Dict[str, str], int]:
    masked: Dict[str, str] = {}
    total = 0
    for key, text in fields.items():
        cleaned, summary = mask_pii(text)
        masked[key] = cleaned
        total += summary["total"]
    return masked, total


def create_app() -> Flask:
    app = Flask(__name__, static_folder=str(STATIC_DIST_DIR), static_url_path="")
    app.config["MAX_CONTENT_LENGTH"] = 64 * 1024

    def _client_ip() -> str:
        if os.environ.get("TRUST_PROXY", "false").lower() == "true":
            forwarded = request.headers.get("X-Forwarded-For", "")
            if forwarded:
                return forwarded.split(",")[0].strip()
        return request.remote_addr or "local"

    @app.errorhandler(413)
    def payload_too_large(_err):
        return jsonify({"error": "Request payload exceeds the 64 KB limit."}), 413

    @app.errorhandler(405)
    def method_not_allowed(err):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Method not allowed for this API endpoint."}), 405
        return err

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "pmfa-studio"})

    @app.get("/api/examples")
    def examples():
        try:
            provider = get_active_provider()
        except LLMServiceError:
            provider = "unconfigured"
        return jsonify(
            {
                "factors": PMFA_FACTORS,
                "arene_tiers": ARENE_TIERS,
                "evidence_formats": EVIDENCE_FORMAT_OPTIONS,
                "samples": SAMPLE_ASSIGNMENTS,
                "active_provider": provider,
            }
        )

    @app.post("/api/analyze")
    def analyze():
        body, json_err = _get_json_dict()
        if json_err or body is None:
            return jsonify({"error": json_err}), 400

        fields, val_err = _parse_assignment_inputs(body)
        if val_err or fields is None:
            return jsonify({"error": val_err}), 400

        if not rate_limiter.allow(_client_ip()):
            return jsonify({"error": "Hourly demo rate limit reached. Please try again later."}), 429

        safe, total_masked = _mask_field_map(
            {
                "title": fields["title"],
                "learning_outcomes": fields["learning_outcomes"],
                "assignment_text": fields["assignment_text"],
                "custom_ai_rules": fields["custom_ai_rules"],
            }
        )

        try:
            result = analyze_assignment(
                safe["title"],
                safe["learning_outcomes"],
                safe["assignment_text"],
                fields["arene_tier"],
                safe["custom_ai_rules"],
            )
        except LLMServiceError as exc:
            return jsonify({"error": str(exc)}), exc.status_code

        return jsonify({"analysis": result, "pii_masked_count": total_masked})

    @app.post("/api/student-checkin")
    def student_checkin():
        body, json_err = _get_json_dict()
        if json_err or body is None:
            return jsonify({"error": json_err}), 400

        validated_cp = validate_checkpoint(body.get("checkpoint"))
        if validated_cp is None:
            return jsonify(
                {
                    "error": (
                        "Checkpoint must be an object with non-empty title, timing, "
                        "student_prompt, reflection_question, and evidence_artifact (<= 4000 chars each)."
                    )
                }
            ), 400

        fields, val_err = _parse_assignment_inputs(body)
        if val_err or fields is None:
            return jsonify({"error": val_err}), 400

        student_fields: Dict[str, str] = {}
        for key in ("student_draft", "chosen_evidence_format", "ai_disclosure", "disclosure_note"):
            val, str_err = _get_str_field(body, key)
            if str_err:
                return jsonify({"error": str_err}), 400
            student_fields[key] = val

        student_draft = student_fields["student_draft"]
        chosen_evidence_format = student_fields["chosen_evidence_format"]
        ai_disclosure = student_fields["ai_disclosure"]
        disclosure_note = student_fields["disclosure_note"]

        if not student_draft:
            return jsonify({"error": "Please enter a short student check-in draft first."}), 400
        if len(chosen_evidence_format) > MAX_SHORT_LEN:
            return jsonify({"error": f"Short fields must be {MAX_SHORT_LEN} characters or fewer."}), 400
        if (
            len(student_draft) > MAX_TEXT_LEN
            or len(ai_disclosure) > MAX_TEXT_LEN
            or len(disclosure_note) > MAX_TEXT_LEN
        ):
            return jsonify({"error": f"Text inputs must be {MAX_TEXT_LEN} characters or fewer."}), 400

        arene_tier = fields["arene_tier"]
        ai_enabled = ARENE_TIERS[arene_tier]["student_ai_enabled"]

        if ai_enabled and not rate_limiter.allow(_client_ip()):
            return jsonify({"error": "Hourly demo rate limit reached. Please try again later."}), 429

        if ai_enabled:
            safe_fields, fields_masked = _mask_field_map(
                {
                    "title": fields["title"],
                    "learning_outcomes": fields["learning_outcomes"],
                    "assignment_text": fields["assignment_text"],
                    "custom_ai_rules": fields["custom_ai_rules"],
                    "student_draft": student_draft,
                    "chosen_evidence_format": chosen_evidence_format,
                    "ai_disclosure": ai_disclosure,
                    "disclosure_note": disclosure_note,
                }
            )
            safe_cp, cp_masked = _mask_field_map(validated_cp)
            total_masked = fields_masked + cp_masked
        else:
            safe_fields = {
                **fields,
                "student_draft": student_draft,
                "chosen_evidence_format": chosen_evidence_format,
                "ai_disclosure": ai_disclosure,
                "disclosure_note": disclosure_note,
            }
            safe_cp = validated_cp
            total_masked = 0

        try:
            feedback = run_student_checkin(
                title=safe_fields["title"],
                learning_outcomes=safe_fields["learning_outcomes"],
                assignment_text=safe_fields["assignment_text"],
                checkpoint=safe_cp,
                student_draft=safe_fields["student_draft"],
                chosen_evidence_format=safe_fields["chosen_evidence_format"],
                arene_tier=arene_tier,
                custom_ai_rules=safe_fields["custom_ai_rules"],
                ai_disclosure=safe_fields["ai_disclosure"],
                disclosure_note=safe_fields["disclosure_note"],
            )
        except LLMServiceError as exc:
            return jsonify({"error": str(exc)}), exc.status_code

        return jsonify(
            {
                "feedback": feedback,
                "pii_masked_count": total_masked,
                "ai_assisted": ai_enabled,
            }
        )

    @app.post("/api/export")
    def export_blueprint():
        body, json_err = _get_json_dict()
        if json_err or body is None:
            return jsonify({"error": json_err}), 400

        fields, val_err = _parse_assignment_inputs(body)
        if val_err or fields is None:
            return jsonify({"error": val_err}), 400

        try:
            markdown = validate_and_render_blueprint(
                title=fields["title"],
                learning_outcomes=fields["learning_outcomes"],
                assignment_text=fields["assignment_text"],
                arene_tier=fields["arene_tier"],
                custom_ai_rules=fields["custom_ai_rules"],
                analysis=body.get("analysis"),
            )
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        return jsonify({"markdown": markdown, "filename": "pmfa-assessment-blueprint.md"})

    @app.route("/api/<path:_unknown>", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    def api_not_found(_unknown: str):
        for rule in app.url_map.iter_rules():
            if rule.endpoint != "api_not_found" and rule.rule == request.path:
                return jsonify({"error": "Method not allowed for this API endpoint."}), 405
        return jsonify({"error": "API endpoint not found."}), 404

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path: str):
        if STATIC_DIST_DIR.exists():
            resolved_root = STATIC_DIST_DIR.resolve()
            if path:
                target = (STATIC_DIST_DIR / path).resolve()
                if target.is_relative_to(resolved_root) and target.is_file():
                    return send_from_directory(STATIC_DIST_DIR, path)
            index_file = STATIC_DIST_DIR / "index.html"
            if index_file.exists():
                return send_from_directory(STATIC_DIST_DIR, "index.html")
        return jsonify(
            {
                "message": "P-MFA Studio Flask API is running. Build frontend into backend/static_dist or run Vite dev server.",
                "endpoints": ["/api/health", "/api/examples", "/api/analyze", "/api/student-checkin", "/api/export"],
            }
        )

    return app


app = create_app()

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=os.environ.get("FLASK_DEBUG", "false").lower() == "true",
    )
