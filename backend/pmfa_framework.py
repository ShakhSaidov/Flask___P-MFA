from typing import Any, Dict, List, Optional

MAX_TEXT_LEN = 4000
MAX_SHORT_LEN = 400

REQUIRED_CHECKPOINT_FIELDS = (
    "title",
    "timing",
    "student_prompt",
    "reflection_question",
    "evidence_artifact",
)

FACTOR_KEY_MAP = [
    ("knowledge", "Knowledge"),
    ("outputs", "Outputs"),
    ("application", "Application"),
    ("process_continuity", "Process Continuity"),
    ("self_evaluation", "Self-Evaluation"),
    ("situated_understanding", "Situated Understanding"),
]

CANONICAL_COVERAGE = {
    "explicitly evidenced": "Explicitly Evidenced",
    "implicit / unverified": "Implicit / Unverified",
    "not captured": "Not Captured",
}

CANONICAL_ALIGNMENT_STATUS = {
    "well aligned": "Well Aligned",
    "review recommended": "Review Recommended",
    "potential alignment gap": "Potential Alignment Gap",
}

PMFA_FACTORS = [
    {
        "key": "Knowledge",
        "description": "What students know: conceptual grasp and domain reasoning beyond surface prose.",
    },
    {
        "key": "Outputs",
        "description": "What students produce: intermediate drafts, plans, or artifacts alongside final deliverables.",
    },
    {
        "key": "Application",
        "description": "What students can do: transferring concepts to concrete analysis or practical tasks.",
    },
    {
        "key": "Process Continuity",
        "description": "What students sustain over time: observable progression across staged checkpoints.",
    },
    {
        "key": "Self-Evaluation",
        "description": "What students reflect upon: evaluating choices, limitations, and AI/tool interactions.",
    },
    {
        "key": "Situated Understanding",
        "description": "How students connect knowledge to real workplace, clinical, ethical, or Finnish societal contexts.",
    },
]

ARENE_TIERS = {
    "blue": {
        "label": "Blue — AI Required & Reported",
        "short_title": "Blue · AI Required",
        "short_desc": "Students must use AI and report how they used and verified it.",
        "badge": "#1d4ed8",
        "student_ai_enabled": True,
        "requires_disclosure": True,
        "rule": "Students must use AI in the assignment and report how AI outputs were prompted, evaluated, and verified.",
    },
    "green": {
        "label": "Green — AI Allowed (No Reporting Needed)",
        "short_title": "Green · AI Allowed",
        "short_desc": "AI allowed within course instructions. No reporting required.",
        "badge": "#15803d",
        "student_ai_enabled": True,
        "requires_disclosure": False,
        "rule": "AI use is allowed within the assignment and course instructions. No AI-use report is required.",
    },
    "yellow": {
        "label": "Yellow — AI Allowed Within Bounds & Reported",
        "short_title": "Yellow · AI With Rules",
        "short_desc": "Allowed within your boundaries. Must be documented and reported.",
        "badge": "#b45309",
        "student_ai_enabled": True,
        "requires_disclosure": True,
        "rule": "Students may use AI within teacher-defined boundaries and must document and reflect on its use. AI can never be the author.",
    },
    "red": {
        "label": "Red — AI Prohibited",
        "short_title": "Red · No AI",
        "short_desc": "No AI for graded work. Relies on independent and oral/process checks.",
        "badge": "#b91c1c",
        "student_ai_enabled": False,
        "requires_disclosure": False,
        "rule": "AI must not be used to create graded work. This prototype disables AI Coach feedback under the Red tier; assessment relies on independent process evidence and oral or controlled verification.",
    },
}

EVIDENCE_FORMAT_OPTIONS = [
    "Versioned draft notes with self-critique comments",
    "2-minute screen/voice walkthrough explaining decisions",
    "Annotated search & source-selection log",
    "In-class / peer Q&A defense summary",
]

# Ordered Blue -> Green -> Yellow -> Red to match ARENE_TIERS 1-to-1.
# All four scenarios are illustrative, synthetic examples (not real Metropolia course tasks).
SAMPLE_ASSIGNMENTS = [
    {
        "id": "ict-api",
        "title": "Web Service & API Engineering — Mini Project",
        "school": "Technology (ICT)",
        "arene_tier": "blue",
        "custom_ai_rules": "AI coding assistants are required for scaffolding; students must explain every route, test edge cases, and document prompt iterations.",
        "learning_outcomes": (
            "1. Design and test a RESTful backend service with clear separation of concerns.\n"
            "2. Critically evaluate AI-generated code for security, edge cases, and maintainability.\n"
            "3. Document architectural decisions and trade-offs."
        ),
        "assignment_text": (
            "Use an AI coding assistant to build a small Flask REST API that tracks campus room bookings. "
            "Submit a GitHub repository link and a short 1-page summary at the end of Week 6."
        ),
        "sample_student_draft": (
            "I scaffolded the Flask endpoints and input checks, then wrote pytest tests for invalid dates "
            "and noticed overlapping room bookings were not prevented."
        ),
        "sample_ai_disclosure": "Used an AI coding assistant to generate initial Flask routes; manually reviewed validation logic and wrote edge-case tests.",
    },
    {
        "id": "design-prototype",
        "title": "Accessible Public Service Concept — Helsinki Mobility",
        "school": "Culture (Design & Media)",
        "arene_tier": "green",
        "custom_ai_rules": "AI is permitted for ideation, copy drafts, and accessibility checklists within course guidelines; final validation must come from observed user testing.",
        "learning_outcomes": (
            "1. Apply universal design and WCAG accessibility principles to a public digital service.\n"
            "2. Iterate a service concept based on real user observations in the Helsinki metropolitan area.\n"
            "3. Communicate design trade-offs clearly to non-technical stakeholders."
        ),
        "assignment_text": (
            "Design an accessible mobile ticket flow for commuters with visual or cognitive impairments. "
            "Submit a final Figma prototype link and a 1,000-word rationale at the end of the sprint."
        ),
        "sample_student_draft": (
            "I sketched a high-contrast two-step route selector after observing simulated commuter pain points with small map pins."
        ),
        "sample_ai_disclosure": "",
    },
    {
        "id": "healthcare-impact",
        "title": "Impact of Artificial Intelligence on Healthcare",
        "school": "Health Care & Social Services",
        "arene_tier": "yellow",
        "custom_ai_rules": "AI permitted for initial keyword brainstorming and language checking; students must select sources and write or evaluate the critical appraisal independently.",
        "learning_outcomes": (
            "1. Critically appraise peer-reviewed evidence on AI tools in clinical workflows.\n"
            "2. Evaluate Finnish/EU patient-safety, GDPR, and ethical implications.\n"
            "3. Justify recommendations using evidence-based clinical reasoning."
        ),
        "assignment_text": (
            "Write a report about the impact of artificial intelligence on healthcare. "
            "Include at least 8 academic references in APA style and submit one final PDF on Moodle by the end of the course."
        ),
        "sample_student_draft": (
            "I want to examine AI triage tools in Finnish primary care. I found 4 PubMed studies "
            "and plan to focus on how nurses double-check false negatives in urgent care."
        ),
        "sample_ai_disclosure": "Used AI to brainstorm MeSH search keywords; selected and read all 4 PubMed abstracts myself.",
    },
    {
        "id": "business-ethics",
        "title": "Nordic Corporate Governance & Whistleblowing Case",
        "school": "Business",
        "arene_tier": "red",
        "custom_ai_rules": "No generative AI tools allowed for drafting or analysis; assessment relies on independent case reasoning.",
        "learning_outcomes": (
            "1. Analyze conflicting stakeholder duties under EU whistleblowing directives.\n"
            "2. Defend an ethical stance independently under questioning.\n"
            "3. Connect governance theory to real Nordic workplace dilemmas."
        ),
        "assignment_text": (
            "Read the attached corporate whistleblowing case study and submit a 2,000-word take-home essay evaluating the board's decision. "
            "AI tools are strictly forbidden for this assignment."
        ),
        "sample_student_draft": (
            "I mapped the conflict between board confidentiality and the EU Whistleblower Directive, and want to argue for an external reporting channel."
        ),
        "sample_ai_disclosure": "",
    },
]


def validate_assignment_inputs(
    title: Any,
    learning_outcomes: Any,
    assignment_text: Any,
    arene_tier: Any,
    custom_ai_rules: Any = "",
) -> Dict[str, str]:
    if (
        not isinstance(title, str)
        or not isinstance(learning_outcomes, str)
        or not isinstance(assignment_text, str)
    ):
        raise ValueError("Title, learning outcomes, and assignment text are required.")

    clean_title = title.strip()
    clean_outcomes = learning_outcomes.strip()
    clean_assignment = assignment_text.strip()
    clean_tier = arene_tier.strip().lower() if isinstance(arene_tier, str) else ""

    if custom_ai_rules is None:
        clean_rules = ""
    elif isinstance(custom_ai_rules, str):
        clean_rules = custom_ai_rules.strip()
    else:
        raise ValueError("Course-specific AI rules must be a string.")

    if not clean_title or not clean_outcomes or not clean_assignment:
        raise ValueError("Title, learning outcomes, and assignment text are required.")
    if len(clean_title) > MAX_SHORT_LEN:
        raise ValueError(f"Title must be {MAX_SHORT_LEN} characters or fewer.")
    if (
        len(clean_outcomes) > MAX_TEXT_LEN
        or len(clean_assignment) > MAX_TEXT_LEN
        or len(clean_rules) > MAX_TEXT_LEN
    ):
        raise ValueError(f"Inputs must be {MAX_TEXT_LEN} characters or fewer.")
    if clean_tier not in ARENE_TIERS:
        raise ValueError("A valid Arene AI tier (blue, green, yellow, red) is required.")

    return {
        "title": clean_title,
        "learning_outcomes": clean_outcomes,
        "assignment_text": clean_assignment,
        "arene_tier": clean_tier,
        "custom_ai_rules": clean_rules,
    }


def validate_checkpoint(raw_cp: Any, max_len: int = MAX_TEXT_LEN) -> Optional[Dict[str, str]]:
    if not isinstance(raw_cp, dict):
        return None
    cleaned: Dict[str, str] = {}
    for field in REQUIRED_CHECKPOINT_FIELDS:
        val = raw_cp.get(field)
        if not isinstance(val, str) or not val.strip():
            return None
        text = val.strip()
        if len(text) > max_len:
            return None
        cleaned[field] = text
    return cleaned


def _require_clean_str(val: Any, label: str, max_len: int = MAX_TEXT_LEN) -> str:
    if not isinstance(val, str) or not val.strip():
        raise ValueError(f"{label} is required.")
    text = val.strip()
    if len(text) > max_len:
        raise ValueError(f"{label} must be {max_len} characters or fewer.")
    return text


def validate_and_render_blueprint(
    title: str,
    learning_outcomes: str,
    assignment_text: str,
    arene_tier: str,
    custom_ai_rules: str,
    analysis: Any,
) -> str:
    fields = validate_assignment_inputs(
        title=title,
        learning_outcomes=learning_outcomes,
        assignment_text=assignment_text,
        arene_tier=arene_tier,
        custom_ai_rules=custom_ai_rules,
    )
    if not isinstance(analysis, dict):
        raise ValueError("A valid analysis object is required for export.")

    alert = analysis.get("misalignment_alert")
    factors = analysis.get("factors")
    checkpoints = analysis.get("proposed_checkpoints")
    disclosure = analysis.get("arene_disclosure_note")

    if not isinstance(alert, dict):
        raise ValueError("Analysis payload is incomplete or malformed.")
    alert_summary = _require_clean_str(alert.get("summary"), "Alignment summary")
    raw_status = alert.get("status")
    if not isinstance(raw_status, str) or raw_status.strip().lower() not in CANONICAL_ALIGNMENT_STATUS:
        raise ValueError("Analysis payload is incomplete or malformed.")
    canonical_alert_status = CANONICAL_ALIGNMENT_STATUS[raw_status.strip().lower()]

    if not isinstance(factors, list) or len(factors) != 6:
        raise ValueError("Analysis payload is incomplete or malformed.")
    if not isinstance(checkpoints, list) or len(checkpoints) != 3:
        raise ValueError("Analysis payload is incomplete or malformed.")

    disclosure_text = _require_clean_str(disclosure, "Student AI disclosure note")

    validated_factors: List[Dict[str, str]] = []
    for f in factors:
        if not isinstance(f, dict):
            raise ValueError("One or more P-MFA factor entries are invalid.")
        raw_cov = f.get("coverage")
        if not isinstance(raw_cov, str) or raw_cov.strip().lower() not in CANONICAL_COVERAGE:
            raise ValueError("One or more P-MFA factor entries are invalid.")
        name = _require_clean_str(f.get("name"), "Factor name", MAX_SHORT_LEN)
        diagnosis = _require_clean_str(f.get("diagnosis"), "Factor observation")
        recommendation = _require_clean_str(f.get("recommendation"), "Factor recommendation")
        evidence_basis = ""
        if isinstance(f.get("evidence_basis"), str) and f["evidence_basis"].strip():
            evidence_basis = f["evidence_basis"].strip()
            if len(evidence_basis) > MAX_TEXT_LEN:
                raise ValueError("Factor evidence basis is too long.")
        validated_factors.append(
            {
                "name": name,
                "coverage": CANONICAL_COVERAGE[raw_cov.strip().lower()],
                "evidence_basis": evidence_basis,
                "diagnosis": diagnosis,
                "recommendation": recommendation,
            }
        )

    validated_checkpoints: List[Dict[str, str]] = []
    for cp in checkpoints:
        cleaned_cp = validate_checkpoint(cp)
        if cleaned_cp is None:
            raise ValueError("One or more checkpoint entries are incomplete or invalid.")
        validated_checkpoints.append(cleaned_cp)

    tier_label = ARENE_TIERS[fields["arene_tier"]]["label"]
    lines = [
        f"# P-MFA Assessment Blueprint: {fields['title']}",
        "",
        f"**Student Arene AI Policy Tier:** {tier_label}",
    ]
    if fields["custom_ai_rules"]:
        lines.append(f"**Course-Specific AI Boundaries:** {fields['custom_ai_rules']}")

    lines.extend(
        [
            "",
            "## 1. Learning Outcomes",
            fields["learning_outcomes"],
            "",
            "## 2. Original Assignment Instructions",
            fields["assignment_text"],
            "",
            f"## 3. Constructive Alignment Observations ({canonical_alert_status})",
            alert_summary,
            "",
        ]
    )

    specific_gaps = alert.get("specific_gaps")
    if isinstance(specific_gaps, list):
        for gap in specific_gaps:
            if isinstance(gap, str) and gap.strip():
                lines.append(f"- {gap.strip()[:MAX_TEXT_LEN]}")

    lines.extend(["", "## 4. Six-Factor P-MFA Design Coverage (Lecturer-Reviewed Draft)"])
    for f in validated_factors:
        lines.append(f"### {f['name']} — *{f['coverage']}*")
        if f["evidence_basis"]:
            lines.append(f"- **Evidence Basis:** {f['evidence_basis']}")
        lines.append(f"- **Observation:** {f['diagnosis']}")
        lines.append(f"- **Suggested Adjustment:** {f['recommendation']}")
        lines.append("")

    lines.append("## 5. Process Checkpoints (Lecturer-Reviewed & Editable)")
    for idx, cp in enumerate(validated_checkpoints, start=1):
        lines.extend(
            [
                f"### Checkpoint {idx}: {cp['title']} ({cp['timing']})",
                f"- **Task Prompt:** {cp['student_prompt']}",
                f"- **Reflection Question:** {cp['reflection_question']}",
                f"- **Evidence Artifact:** {cp['evidence_artifact']}",
                "",
            ]
        )

    lines.extend(
        [
            "## 6. Student AI Policy & Disclosure Draft",
            disclosure_text,
            "",
            "_Note: Generated as an editable design draft inspired by P-MFA (Hämäläinen & Leiviskä, 2025). Final pedagogical and grading judgment rests with the instructor._",
            "",
        ]
    )

    return "\n".join(lines)
