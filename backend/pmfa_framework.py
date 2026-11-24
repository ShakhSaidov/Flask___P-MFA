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
        "badge": "#1d4ed8",
        "student_ai_enabled": True,
        "requires_disclosure": True,
        "rule": "Students must use AI in the assignment and report how AI outputs were prompted, evaluated, and verified.",
    },
    "green": {
        "label": "Green — AI Allowed (No Reporting Needed)",
        "badge": "#15803d",
        "student_ai_enabled": True,
        "requires_disclosure": False,
        "rule": "Students may use AI freely for brainstorming, drafting support, or language polishing without mandatory reporting.",
    },
    "yellow": {
        "label": "Yellow — AI Allowed Within Bounds & Reported",
        "badge": "#b45309",
        "student_ai_enabled": True,
        "requires_disclosure": True,
        "rule": "Students may use AI within teacher-defined boundaries and must document and reflect on its use. AI can never be the author.",
    },
    "red": {
        "label": "Red — AI Prohibited",
        "badge": "#b91c1c",
        "student_ai_enabled": False,
        "requires_disclosure": False,
        "rule": "Student AI assistance is prohibited to verify independent competence. Assessment relies on staged process evidence and controlled or oral verification.",
    },
}

EVIDENCE_FORMAT_OPTIONS = [
    "Annotated search & source-selection log",
    "2-minute screen/voice walkthrough explaining decisions",
    "Versioned draft notes with self-critique comments",
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
        "custom_ai_rules": "Students may freely use AI for ideation, copy drafts, or accessibility checklists; final field validation must come from real user observations.",
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
            "Illustrative draft: I sketched a high-contrast two-step route selector after observing simulated commuter pain points with small map pins."
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
