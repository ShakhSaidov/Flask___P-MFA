import os
import time
from collections import defaultdict, deque
from pathlib import Path
from threading import Lock
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory

from .llm_service import (
    CANONICAL_ALIGNMENT_STATUS,
    CANONICAL_COVERAGE,
    LLMServiceError,
    analyze_assignment,
    get_active_provider,
    run_student_checkin,
)
from .pii_guard import mask_pii
from .pmfa_framework import (
    ARENE_TIERS,
    EVIDENCE_FORMAT_OPTIONS,
    PMFA_FACTORS,
    SAMPLE_ASSIGNMENTS,
)

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

STATIC_DIST_DIR = BASE_DIR / "static_dist"
MAX_TEXT_LEN = 4000
MAX_SHORT_LEN = 400
REQUIRED_CHECKPOINT_FIELDS = (
    "title",
    "timing",
    "student_prompt",
    "reflection_question",
    "evidence_artifact",
)


class SimpleRateLimiter:
    """Lightweight process-local per-IP sliding-window protection for demo API calls."""

    def __init__(self, max_requests: int = 30, window_seconds: int = 3600, max_tracked_ips: int = 5000):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.max_tracked_ips = max_tracked_ips
        self._hits: Dict[str, deque] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = time.time()
        with self._lock:
            if len(self._hits) > self.max_tracked_ips:
                stale_keys = [
                    ip for ip, dq in self._hits.items() if not dq or (now - dq[-1] > self.window_seconds)
                ]
                for ip in stale_keys:
                    del self._hits[ip]

            q = self._hits[key]
            while q and now - q[0] > self.window_seconds:
                q.popleft()
            if len(q) >= self.max_requests:
                return False
            q.append(now)
            return True


rate_limiter = SimpleRateLimiter(max_requests=30, window_seconds=3600)


def _get_json_dict() -> Optional[Dict[str, Any]]:
    body = request.get_json(silent=True)
    if body is None:
        return {}
    if not isinstance(body, dict):
        return None
    return body


def _clean_str(body: Dict[str, Any], key: str, default: str = "") -> str:
    val = body.get(key)
    if not isinstance(val, str):
        return default
    return val.strip()


def _validate_checkpoint_dict(raw_cp: Any) -> Optional[Dict[str, str]]:
    if not isinstance(raw_cp, dict):
        return None
    cleaned: Dict[str, str] = {}
    for field in REQUIRED_CHECKPOINT_FIELDS:
        val = raw_cp.get(field)
        if not isinstance(val, str) or not val.strip():
            return None
        text = val.strip()
        if len(text) > MAX_TEXT_LEN:
            return None
        cleaned[field] = text
    return cleaned


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
        body = _get_json_dict()
        if body is None:
            return jsonify({"error": "Request body must be a JSON object."}), 400

        title = _clean_str(body, "title")
        learning_outcomes = _clean_str(body, "learning_outcomes")
        assignment_text = _clean_str(body, "assignment_text")
        arene_tier = _clean_str(body, "arene_tier").lower()
        custom_ai_rules = _clean_str(body, "custom_ai_rules")

        if not title or not learning_outcomes or not assignment_text:
            return jsonify({"error": "Title, learning outcomes, and assignment text are required."}), 400
        if len(title) > MAX_SHORT_LEN:
            return jsonify({"error": f"Title must be {MAX_SHORT_LEN} characters or fewer."}), 400
        if (
            len(learning_outcomes) > MAX_TEXT_LEN
            or len(assignment_text) > MAX_TEXT_LEN
            or len(custom_ai_rules) > MAX_TEXT_LEN
        ):
            return jsonify({"error": f"Inputs must be {MAX_TEXT_LEN} characters or fewer."}), 400
        if arene_tier not in ARENE_TIERS:
            return jsonify({"error": "A valid Arene AI tier (blue, green, yellow, red) is required."}), 400

        if not rate_limiter.allow(_client_ip()):
            return jsonify({"error": "Hourly demo rate limit reached. Please try again later."}), 429

        safe_title, mask_title = mask_pii(title)
        safe_outcomes, mask_out = mask_pii(learning_outcomes)
        safe_assignment, mask_assign = mask_pii(assignment_text)
        safe_rules, mask_rules = mask_pii(custom_ai_rules)
        total_masked = (
            mask_title["total"] + mask_out["total"] + mask_assign["total"] + mask_rules["total"]
        )

        try:
            result = analyze_assignment(safe_title, safe_outcomes, safe_assignment, arene_tier, safe_rules)
        except LLMServiceError as exc:
            return jsonify({"error": str(exc)}), exc.status_code

        return jsonify({"analysis": result, "pii_masked_count": total_masked})

    @app.post("/api/student-checkin")
    def student_checkin():
        body = _get_json_dict()
        if body is None:
            return jsonify({"error": "Request body must be a JSON object."}), 400

        validated_cp = _validate_checkpoint_dict(body.get("checkpoint"))
        if validated_cp is None:
            return jsonify(
                {
                    "error": (
                        "Checkpoint must be an object with non-empty title, timing, "
                        "student_prompt, reflection_question, and evidence_artifact (<= 4000 chars each)."
                    )
                }
            ), 400

        title = _clean_str(body, "title")
        learning_outcomes = _clean_str(body, "learning_outcomes")
        assignment_text = _clean_str(body, "assignment_text")
        student_draft = _clean_str(body, "student_draft")
        chosen_evidence_format = _clean_str(body, "chosen_evidence_format")
        arene_tier = _clean_str(body, "arene_tier").lower()
        custom_ai_rules = _clean_str(body, "custom_ai_rules")
        ai_disclosure = _clean_str(body, "ai_disclosure")

        if not title or not learning_outcomes or not assignment_text:
            return jsonify(
                {"error": "Assignment title, learning outcomes, and assignment instructions are required."}
            ), 400
        if not student_draft:
            return jsonify({"error": "Please enter a short student check-in draft first."}), 400
        if len(title) > MAX_SHORT_LEN or len(chosen_evidence_format) > MAX_SHORT_LEN:
            return jsonify({"error": f"Short fields must be {MAX_SHORT_LEN} characters or fewer."}), 400
        if (
            len(student_draft) > MAX_TEXT_LEN
            or len(learning_outcomes) > MAX_TEXT_LEN
            or len(assignment_text) > MAX_TEXT_LEN
            or len(custom_ai_rules) > MAX_TEXT_LEN
            or len(ai_disclosure) > MAX_TEXT_LEN
        ):
            return jsonify({"error": f"Text inputs must be {MAX_TEXT_LEN} characters or fewer."}), 400
        if arene_tier not in ARENE_TIERS:
            return jsonify({"error": "A valid Arene AI tier (blue, green, yellow, red) is required."}), 400

        if ARENE_TIERS[arene_tier]["student_ai_enabled"] and not rate_limiter.allow(_client_ip()):
            return jsonify({"error": "Hourly demo rate limit reached. Please try again later."}), 429

        safe_title, m_title = mask_pii(title)
        safe_outcomes, m_out = mask_pii(learning_outcomes)
        safe_assignment, m_assign = mask_pii(assignment_text)
        safe_draft, m_draft = mask_pii(student_draft)
        safe_format, m_fmt = mask_pii(chosen_evidence_format)
        safe_rules, m_rules = mask_pii(custom_ai_rules)
        safe_disclosure, m_disc = mask_pii(ai_disclosure)

        safe_cp: Dict[str, str] = {}
        cp_masked = 0
        for field, text in validated_cp.items():
            cleaned, m = mask_pii(text)
            safe_cp[field] = cleaned
            cp_masked += m["total"]

        total_masked = (
            m_title["total"]
            + m_out["total"]
            + m_assign["total"]
            + m_draft["total"]
            + m_fmt["total"]
            + m_rules["total"]
            + m_disc["total"]
            + cp_masked
        )

        try:
            feedback = run_student_checkin(
                title=safe_title,
                learning_outcomes=safe_outcomes,
                assignment_text=safe_assignment,
                checkpoint=safe_cp,
                student_draft=safe_draft,
                chosen_evidence_format=safe_format,
                arene_tier=arene_tier,
                custom_ai_rules=safe_rules,
                ai_disclosure=safe_disclosure,
            )
        except LLMServiceError as exc:
            return jsonify({"error": str(exc)}), exc.status_code

        return jsonify(
            {
                "feedback": feedback,
                "pii_masked_count": total_masked,
                "ai_assisted": ARENE_TIERS[arene_tier]["student_ai_enabled"],
            }
        )

    @app.post("/api/export")
    def export_blueprint():
        body = _get_json_dict()
        if body is None:
            return jsonify({"error": "Request body must be a JSON object."}), 400

        title = _clean_str(body, "title")
        learning_outcomes = _clean_str(body, "learning_outcomes")
        assignment_text = _clean_str(body, "assignment_text")
        arene_tier = _clean_str(body, "arene_tier").lower()
        custom_ai_rules = _clean_str(body, "custom_ai_rules")

        if not title or not learning_outcomes or not assignment_text:
            return jsonify({"error": "Title, learning outcomes, and assignment text are required for export."}), 400
        if arene_tier not in ARENE_TIERS:
            return jsonify({"error": "A valid Arene AI tier (blue, green, yellow, red) is required for export."}), 400

        analysis = body.get("analysis")
        if not isinstance(analysis, dict):
            return jsonify({"error": "A valid analysis object is required for export."}), 400

        alert = analysis.get("misalignment_alert")
        factors = analysis.get("factors")
        checkpoints = analysis.get("proposed_checkpoints")
        disclosure = analysis.get("arene_disclosure_note")

        if (
            not isinstance(alert, dict)
            or not isinstance(alert.get("summary"), str)
            or not alert["summary"].strip()
            or not isinstance(alert.get("status"), str)
            or alert["status"].strip().lower() not in CANONICAL_ALIGNMENT_STATUS
            or not isinstance(factors, list)
            or len(factors) != 6
            or not isinstance(checkpoints, list)
            or len(checkpoints) != 3
            or not isinstance(disclosure, str)
            or not disclosure.strip()
        ):
            return jsonify({"error": "Analysis payload is incomplete or malformed."}), 400

        for f in factors:
            if (
                not isinstance(f, dict)
                or not isinstance(f.get("name"), str)
                or not f["name"].strip()
                or not isinstance(f.get("coverage"), str)
                or f["coverage"].strip().lower() not in CANONICAL_COVERAGE
                or not isinstance(f.get("diagnosis"), str)
                or not f["diagnosis"].strip()
                or not isinstance(f.get("recommendation"), str)
                or not f["recommendation"].strip()
            ):
                return jsonify({"error": "One or more P-MFA factor entries are invalid."}), 400

        for cp in checkpoints:
            if _validate_checkpoint_dict(cp) is None:
                return jsonify({"error": "One or more checkpoint entries are incomplete or invalid."}), 400

        tier_label = ARENE_TIERS[arene_tier]["label"]

        lines = [
            f"# P-MFA Assessment Blueprint: {title}",
            "",
            f"**Student Arene AI Policy Tier:** {tier_label}",
        ]
        if custom_ai_rules:
            lines.append(f"**Teacher-Defined AI Boundaries:** {custom_ai_rules}")

        lines.extend(
            [
                "",
                "## 1. Learning Outcomes",
                learning_outcomes,
                "",
                "## 2. Original Assignment Instructions",
                assignment_text,
                "",
                f"## 3. Constructive Alignment Observations ({alert['status']})",
                alert["summary"].strip(),
                "",
            ]
        )
        specific_gaps = alert.get("specific_gaps")
        if isinstance(specific_gaps, list):
            for gap in specific_gaps:
                if isinstance(gap, str) and gap.strip():
                    lines.append(f"- {gap.strip()}")

        lines.extend(["", "## 4. Six-Factor P-MFA Design Coverage (Preliminary AI Observations)"])
        for f in factors:
            lines.append(f"### {f['name'].strip()} — *{f['coverage'].strip()}*")
            if isinstance(f.get("evidence_basis"), str) and f["evidence_basis"].strip():
                lines.append(f"- **Evidence Basis:** {f['evidence_basis'].strip()}")
            lines.append(f"- **Design Observation:** {f['diagnosis'].strip()}")
            lines.append(f"- **Suggested Adjustment:** {f['recommendation'].strip()}")
            lines.append("")

        lines.append("## 5. Process Checkpoints (Teacher-Reviewed & Editable)")
        for idx, cp in enumerate(checkpoints, start=1):
            lines.extend(
                [
                    f"### Checkpoint {idx}: {cp['title'].strip()} ({cp['timing'].strip()})",
                    f"- **Task Prompt:** {cp['student_prompt'].strip()}",
                    f"- **Reflection Question:** {cp['reflection_question'].strip()}",
                    f"- **Evidence Artifact:** {cp['evidence_artifact'].strip()}",
                    "",
                ]
            )

        lines.extend(
            [
                "## 6. Draft Student AI Disclosure Policy",
                disclosure.strip(),
                "",
                "_Note: Generated as an editable design draft inspired by P-MFA (Hämäläinen & Leiviskä, 2025). Final pedagogical and grading judgment rests with the instructor._",
                "",
            ]
        )

        return jsonify({"markdown": "\n".join(lines), "filename": "pmfa-assessment-blueprint.md"})

    @app.route("/api/<path:_unknown>", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    def api_not_found(_unknown: str):
        return jsonify({"error": "API endpoint not found."}), 404

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path: str):
        if STATIC_DIST_DIR.exists():
            target = STATIC_DIST_DIR / path
            if path and target.exists() and target.is_file():
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
