from unittest.mock import Mock

import pytest
import requests

from backend import app as app_module
from backend import llm_service
from backend.pii_guard import mask_pii


def _valid_checkpoint(idx: int = 1):
    return {
        "title": f"CP {idx}",
        "timing": f"Week {idx * 2}",
        "student_prompt": f"Prompt {idx}",
        "reflection_question": f"Reflect {idx}",
        "evidence_artifact": f"Artifact {idx}",
    }


def _valid_raw_analysis():
    return {
        "misalignment_alert": {
            "status": "Review Recommended",
            "summary": "Final report alone misses process evidence.",
            "specific_gaps": ["No intermediate source check"],
        },
        "factors": {
            key: {
                "coverage": "Implicit / Unverified",
                "evidence_basis": f"Instructions reference deliverable related to {key}.",
                "diagnosis": f"Observation for {key}",
                "recommendation": f"Recommendation for {key}",
            }
            for key, _ in llm_service.FACTOR_KEY_MAP
        },
        "proposed_checkpoints": [_valid_checkpoint(i) for i in range(1, 4)],
        "arene_disclosure_note": "Declare AI assistance per Yellow tier.",
    }


def test_pii_guard_masks_identifiers_and_preserves_non_pii_numbers():
    text = (
        "Student Matti (matti@metropolia.fi, 131052-308t, +358 40 123 4567, 040-7654321, 0401234567, 091234567) "
        "in 00520 Helsinki studied in 2025-2026 for 10 ECTS (task ref 12345)."
    )
    cleaned, summary = mask_pii(text)
    assert "[EMAIL_REDACTED]" in cleaned
    assert "[FINNISH_ID_REDACTED]" in cleaned
    assert cleaned.count("[PHONE_REDACTED]") == 4
    assert "00520" in cleaned
    assert "2025-2026" in cleaned
    assert "10 ECTS" in cleaned
    assert "12345" in cleaned
    assert summary["total"] == 6


def test_pii_guard_does_not_merge_numbers_across_newlines():
    text = "040 123 4567\nCourse code 2026"
    cleaned, summary = mask_pii(text)
    assert "[PHONE_REDACTED]\nCourse code 2026" == cleaned
    assert summary["phones"] == 1


def test_health_examples_order_and_api_404():
    client = app_module.app.test_client()
    assert client.get("/api/health").status_code == 200

    res = client.get("/api/examples")
    assert res.status_code == 200
    data = res.get_json()
    assert len(data["factors"]) == 6
    assert [s["arene_tier"] for s in data["samples"]] == ["blue", "green", "yellow", "red"]
    assert len(data["evidence_formats"]) >= 4

    missing = client.get("/api/does-not-exist")
    assert missing.status_code == 404
    assert "error" in missing.get_json()


def test_endpoints_require_explicit_valid_arene_tier_and_valid_json():
    client = app_module.app.test_client()
    assert client.post("/api/analyze", json={"title": "Only title"}).status_code == 400
    assert (
        client.post(
            "/api/analyze",
            json={"title": None, "learning_outcomes": "x", "assignment_text": "y", "arene_tier": "yellow"},
        ).status_code
        == 400
    )
    assert client.post("/api/analyze", json=["not", "an", "object"]).status_code == 400
    assert (
        client.post(
            "/api/analyze",
            json={"title": "Demo", "learning_outcomes": "x", "assignment_text": "y"},
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/student-checkin",
            json={
                "title": "Demo",
                "learning_outcomes": "x",
                "assignment_text": "y",
                "checkpoint": _valid_checkpoint(),
                "student_draft": "My draft",
            },
        ).status_code
        == 400
    )


def test_service_layer_rejects_invalid_tier_and_invalid_provider(monkeypatch):
    with pytest.raises(llm_service.LLMServiceError) as exc1:
        llm_service.analyze_assignment("T", "O", "A", "invalid-tier")
    assert exc1.value.status_code == 400

    with pytest.raises(llm_service.LLMServiceError) as exc2:
        llm_service.run_student_checkin("T", "O", "A", _valid_checkpoint(), "Draft", "Log", "")
    assert exc2.value.status_code == 400

    monkeypatch.setenv("LLM_PROVIDER", "ollamma")
    with pytest.raises(llm_service.LLMServiceError) as exc3:
        llm_service.get_active_provider()
    assert exc3.value.status_code == 500


def test_negative_phrases_are_rejected_by_normalization():
    bad_status = _valid_raw_analysis()
    bad_status["misalignment_alert"]["status"] = "Not well aligned"
    with pytest.raises(ValueError):
        llm_service._validate_and_normalize_analysis(bad_status)

    bad_coverage = _valid_raw_analysis()
    bad_coverage["factors"]["knowledge"]["coverage"] = "Not explicitly evidenced"
    with pytest.raises(ValueError):
        llm_service._validate_and_normalize_analysis(bad_coverage)


def test_analyze_masks_pii_and_returns_structured_output(monkeypatch):
    captured = {}

    def fake_analyze(title, outcomes, assignment, tier, custom_rules):
        captured["title"] = title
        captured["assignment"] = assignment
        captured["custom_rules"] = custom_rules
        return llm_service._validate_and_normalize_analysis(_valid_raw_analysis())

    monkeypatch.setattr(app_module, "analyze_assignment", fake_analyze)
    monkeypatch.setattr(app_module, "rate_limiter", app_module.SimpleRateLimiter(30, 3600))
    client = app_module.app.test_client()
    res = client.post(
        "/api/analyze",
        json={
            "title": "Demo for a@b.fi",
            "learning_outcomes": "Critically analyze",
            "assignment_text": "Contact teacher@metropolia.fi for essay PDF.",
            "arene_tier": "yellow",
            "custom_ai_rules": "Brainstorming allowed.",
        },
    )
    assert res.status_code == 200
    assert "[EMAIL_REDACTED]" in captured["title"]
    assert "[EMAIL_REDACTED]" in captured["assignment"]
    assert captured["custom_rules"] == "Brainstorming allowed."
    assert res.get_json()["pii_masked_count"] == 2


def test_student_checkin_validates_checkpoint_and_passes_masked_assignment_text(monkeypatch):
    captured = {}

    def fake_checkin(**kwargs):
        captured.update(kwargs)
        return {
            "strengths": ["Clear clinical focus."],
            "probing_questions": ["How will you verify false negatives?"],
            "evidence_coaching": "Vlog supplements reflection but keep APA references.",
            "alignment_warning": "Aligned with outcome 1.",
            "policy_reminder": "Yellow tier: report AI use.",
        }

    monkeypatch.setattr(app_module, "run_student_checkin", fake_checkin)
    monkeypatch.setattr(app_module, "rate_limiter", app_module.SimpleRateLimiter(30, 3600))
    client = app_module.app.test_client()

    # Empty, incomplete, or oversized checkpoint rejected with 400
    assert (
        client.post(
            "/api/student-checkin",
            json={
                "title": "T",
                "learning_outcomes": "O",
                "assignment_text": "A",
                "student_draft": "Hello",
                "arene_tier": "yellow",
                "checkpoint": {},
            },
        ).status_code
        == 400
    )
    oversized_cp = _valid_checkpoint()
    oversized_cp["student_prompt"] = "x" * (app_module.MAX_TEXT_LEN + 1)
    assert (
        client.post(
            "/api/student-checkin",
            json={
                "title": "T",
                "learning_outcomes": "O",
                "assignment_text": "A",
                "student_draft": "Hello",
                "arene_tier": "yellow",
                "checkpoint": oversized_cp,
            },
        ).status_code
        == 400
    )

    cp = _valid_checkpoint()
    cp["student_prompt"] = "Email tutor@metropolia.fi"
    res = client.post(
        "/api/student-checkin",
        json={
            "title": "AI in Healthcare",
            "learning_outcomes": "Appraise clinical evidence",
            "assignment_text": "Submit 8 APA references; ask coordinator@metropolia.fi if unsure.",
            "checkpoint": cp,
            "student_draft": "I found 4 PubMed papers.",
            "chosen_evidence_format": "Video with 0401234567",
            "ai_disclosure": "Used AI, contact me@metropolia.fi",
            "arene_tier": "yellow",
        },
    )
    assert res.status_code == 200
    payload = res.get_json()
    assert payload["ai_assisted"] is True
    assert payload["pii_masked_count"] == 4
    assert "[EMAIL_REDACTED]" in captured["assignment_text"]
    assert "[PHONE_REDACTED]" in captured["chosen_evidence_format"]
    assert "[EMAIL_REDACTED]" in captured["ai_disclosure"]
    assert "[EMAIL_REDACTED]" in captured["checkpoint"]["student_prompt"]


def test_student_checkin_llm_receives_full_assignment_and_checkpoint(monkeypatch):
    captured_prompt = {}

    def fake_llm(sys_msg, user_prompt, schema, schema_name):
        captured_prompt["sys"] = sys_msg
        captured_prompt["user"] = user_prompt
        return {
            "strengths": ["Good start."],
            "probing_questions": ["How will you cite APA sources?"],
            "evidence_coaching": "Vlog does not replace APA references.",
            "alignment_warning": "Respect custom rules.",
            "policy_reminder": "Yellow rule.",
        }

    monkeypatch.setattr(llm_service, "_call_structured_llm", fake_llm)
    out = llm_service.run_student_checkin(
        title="Healthcare AI",
        learning_outcomes="Appraise evidence",
        assignment_text="Include 8 APA references.",
        checkpoint=_valid_checkpoint(2),
        student_draft="Evaluate my critical appraisal",
        chosen_evidence_format="2-minute vlog",
        arene_tier="yellow",
        custom_ai_rules="Prohibited for critical appraisal.",
        ai_disclosure="",
    )
    assert "Include 8 APA references." in captured_prompt["user"]
    assert "Artifact 2" in captured_prompt["user"]
    assert "Week 4" in captured_prompt["user"]
    assert "REFUSE assistance on that prohibited activity" in captured_prompt["sys"]
    assert out["evidence_coaching"] == "Vlog does not replace APA references."


def test_red_tier_enforces_zero_llm_calls_and_bypasses_rate_limit(monkeypatch):
    limiter = app_module.SimpleRateLimiter(max_requests=0, window_seconds=3600)
    monkeypatch.setattr(app_module, "rate_limiter", limiter)

    def fail_if_called(*args, **kwargs):
        raise AssertionError("LLM should never be called for Red tier")

    monkeypatch.setattr(llm_service, "_call_structured_llm", fail_if_called)

    client = app_module.app.test_client()
    res = client.post(
        "/api/student-checkin",
        json={
            "title": "Ethics Case",
            "learning_outcomes": "Defend stance independently",
            "assignment_text": "Write a 2,000-word take-home essay.",
            "checkpoint": _valid_checkpoint(),
            "student_draft": "My independent outline on EU whistleblowing.",
            "chosen_evidence_format": "In-class / peer Q&A defense summary",
            "arene_tier": "red",
        },
    )
    assert res.status_code == 200
    payload = res.get_json()
    assert payload["ai_assisted"] is False
    assert "not saved" in payload["feedback"]["evidence_coaching"].lower()


def test_rate_limiter_blocks_and_prunes_stale_ips(monkeypatch):
    fake_now = [1000.0]
    monkeypatch.setattr(app_module.time, "time", lambda: fake_now[0])

    limiter = app_module.SimpleRateLimiter(max_requests=2, window_seconds=60, max_tracked_ips=1)
    assert limiter.allow("1.1.1.1") is True
    assert limiter.allow("1.1.1.1") is True
    assert limiter.allow("1.1.1.1") is False

    fake_now[0] = 1100.0  # past window
    assert limiter.allow("2.2.2.2") is True
    assert limiter.allow("3.3.3.3") is True
    assert "1.1.1.1" not in limiter._hits


def test_export_blueprint_validates_strictly_and_preserves_edits():
    client = app_module.app.test_client()
    valid_analysis = llm_service._validate_and_normalize_analysis(_valid_raw_analysis())
    valid_analysis["proposed_checkpoints"][0]["title"] = "Teacher Edited CP1"

    res = client.post(
        "/api/export",
        json={
            "title": "AI in Healthcare",
            "arene_tier": "yellow",
            "learning_outcomes": "Appraise evidence",
            "assignment_text": "Write an APA report and submit one PDF.",
            "analysis": valid_analysis,
        },
    )
    assert res.status_code == 200
    md = res.get_json()["markdown"]
    assert "# P-MFA Assessment Blueprint: AI in Healthcare" in md
    assert "Write an APA report and submit one PDF." in md
    assert "### Checkpoint 1: Teacher Edited CP1" in md
    assert "**Evidence Basis:**" in md

    bad_coverage = llm_service._validate_and_normalize_analysis(_valid_raw_analysis())
    bad_coverage["factors"][0]["coverage"] = "Invented Label"
    assert (
        client.post(
            "/api/export",
            json={
                "title": "Test",
                "arene_tier": "yellow",
                "learning_outcomes": "O",
                "assignment_text": "A",
                "analysis": bad_coverage,
            },
        ).status_code
        == 400
    )


def test_llm_validation_rejects_missing_factors_and_retries_incomplete_checkpoints(monkeypatch):
    incomplete_factors = _valid_raw_analysis()
    del incomplete_factors["factors"]["self_evaluation"]
    with pytest.raises(ValueError):
        llm_service._validate_and_normalize_analysis(incomplete_factors)

    one_checkpoint = _valid_raw_analysis()
    one_checkpoint["proposed_checkpoints"] = one_checkpoint["proposed_checkpoints"][:1]
    with pytest.raises(ValueError):
        llm_service._validate_and_normalize_analysis(one_checkpoint)

    calls = iter([one_checkpoint, _valid_raw_analysis()])
    monkeypatch.setattr(llm_service, "_call_structured_llm", lambda *args, **kwargs: next(calls))
    result = llm_service.analyze_assignment("Title", "Outcomes", "Task", "yellow")
    assert len(result["proposed_checkpoints"]) == 3
    assert len(result["factors"]) == 6


def test_groq_narrow_fallback_and_ollama_timeout(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setenv("GROQ_MODEL", "openai/gpt-oss-120b")

    # 1. Schema unsupported 400 -> triggers json_object fallback
    resp_schema_400 = Mock(status_code=400, text="json_schema unsupported")
    resp_schema_400.json.return_value = {"error": {"message": "This model does not support json_schema"}}

    resp_ok = Mock(status_code=200)
    resp_ok.json.return_value = {
        "choices": [{"finish_reason": "stop", "message": {"content": '{"strengths": ["ok"]}'}}]
    }

    calls = iter([resp_schema_400, resp_ok])
    monkeypatch.setattr(llm_service.requests, "post", lambda *args, **kwargs: next(calls))
    out = llm_service._call_groq_json("sys", "user", {"type": "object"}, "test_schema")
    assert out == {"strengths": ["ok"]}

    # 2. Bad schema / strict 400 without unsupported-feature phrase -> does NOT fall back, hides raw detail
    resp_other_400 = Mock(status_code=400, text="invalid strict schema syntax")
    resp_other_400.json.return_value = {"error": {"message": "Invalid schema property"}}
    monkeypatch.setattr(llm_service.requests, "post", lambda *args, **kwargs: resp_other_400)
    with pytest.raises(llm_service.LLMServiceError) as exc_bad:
        llm_service._call_groq_json("sys", "user", {"type": "object"}, "test_schema")
    assert "Invalid schema property" not in str(exc_bad.value)

    # 3. Ollama path success & timeout
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    resp_ollama = Mock(status_code=200)
    resp_ollama.json.return_value = {"message": {"content": '{"ok": true}'}}
    monkeypatch.setattr(llm_service.requests, "post", lambda *args, **kwargs: resp_ollama)
    assert llm_service._call_structured_llm("s", "u", {}, "x") == {"ok": True}

    def raise_timeout(*args, **kwargs):
        raise requests.Timeout("timed out")

    monkeypatch.setattr(llm_service.requests, "post", raise_timeout)
    with pytest.raises(llm_service.LLMServiceError) as exc_timeout:
        llm_service._call_structured_llm("s", "u", {}, "x")
    assert exc_timeout.value.status_code == 504
