# P-MFA Studio

A small Flask + React R&D prototype exploring **process-oriented assignment design** inspired by *Pedagogical Multi-Factor Assessment (P-MFA)* (Hämäläinen & Leiviskä, 2025) and **Metropolia / Arene AI traffic-light guidelines** (Blue, Green, Yellow, Red).

> **Prototype Scope:** P-MFA Studio is an exploratory R&D prototype inspired by selected P-MFA principles—not a validated institutional implementation, automated grading tool, or persistent LMS integration. All sample scenarios are illustrative synthetic examples.

---

## Why This Problem

Rather than building another Q&A chatbot or document summarizer, P-MFA Studio focuses on a harder assessment problem: when generative AI can produce polished final essays or code, grading solely on a single end-of-course submission loses visibility into authentic learning.

The app models a two-sided workflow:
1. **Lecturer Setup & Design Review:** Audits an assignment against stated learning outcomes and the six P-MFA dimensions (*Knowledge, Outputs, Application, Process Continuity, Self-Evaluation, Situated Understanding*), displaying an explicit `evidence_basis` for each observation and drafting 3 editable progressive checkpoints. Evidence-basis descriptions are model-generated explanations based on the supplied assignment and learning outcomes. They are not source-verified quotations or proof of student competence. Instructors must check these explanations against the original assignment materials and learning outcomes.
3. **Simulated Student Preview:** Lets students select or propose an evidence format for a checkpoint, test a draft reflection, and experience **server-side policy-dependent behaviour** across Arene tiers (including deterministic AI lockout on Red, AI disclosure prompts on Blue/Yellow, and Socratic non-author coaching).

---

## Architecture

- **Backend (`backend/`):** Python Flask application factory (`backend/app.py`) serving a JSON REST API and built frontend assets (`backend/static_dist/`).
- **LLM Layer (`backend/llm_service.py`):** Structured JSON-schema calls supporting both **Groq** (`openai/gpt-oss-120b` with `strict: true` and configurable `reasoning_effort`) and local **Ollama** (`LLM_PROVIDER=ollama`) via a single configuration switch.
- **Best-Effort Pre-Check (`backend/pii_guard.py`):** Lightweight regex helper masking obvious emails, phone numbers, and Finnish personal IDs before model processing while preserving academic year ranges and ECTS credits.
- **Frontend (`frontend/`):** React + Vite single-page workflow.

---

## Local Setup & Running

### 1. Backend
```bash
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1
# Linux/macOS: source .venv/bin/activate

pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
# Add your GROQ_API_KEY to backend/.env (or set LLM_PROVIDER=ollama for local inference)
```

Start Flask (using the prebuilt `backend/static_dist/` bundle):
```bash
python -m backend.app
# or: flask --app backend.app run
```
Open `http://127.0.0.1:5000`.

### 2. Frontend Development (Optional)
If modifying `frontend/src/`:
```bash
cd frontend
npm ci
npm run build   # builds into ../backend/static_dist
```
For live Vite hot-reload alongside Flask:
```bash
cd frontend
npm run dev     # proxies /api -> http://127.0.0.1:5000
```

### 3. Automated Tests
```bash
python -m pytest -v
```

---

## Potential R&D Questions

- Can process-based checkpoints make student competence more visible
  when final submissions may be AI-assisted?
- How reliably can LLMs identify gaps between learning outcomes,
  assignment instructions, and proposed assessment evidence?
- Which evidence formats are practical across different disciplines?
- How can AI support student reflection without replacing independent
  reasoning or producing assessed work?

The current prototype does not collect research data or establish
the effectiveness of these approaches. These are directions for
future evaluation with lecturers and students.

---

## Privacy & Limitations

- **Use synthetic examples only.** Do not enter real student work, names, or sensitive personal data. `pii_guard.py` is best-effort regex masking—**not** full anonymisation or GDPR compliance—and does not detect arbitrary names, addresses, or contextual sensitive facts.
- **Policy enforcement boundaries:** Only the **Red** tier deterministically blocks LLM calls on the backend. Course-specific natural-language rules (`custom_ai_rules`) and the Socratic non-writing constraint rely on prompt-guided model behaviour and cannot guarantee refusal against adversarial inputs.
- **Prototype scope:** No database, authentication, or Moodle integration. The Student Preview runs in-browser without saving or transmitting student drafts to instructors. Rate limiting (`SimpleRateLimiter`) is process-local for demo protection.

---

## References

- Hämäläinen, M., & Leiviskä, K. (2025). [From NLG Evaluation to Modern Student Assessment in the Era of ChatGPT: The Great Misalignment Problem and Pedagogical Multi-Factor Assessment (P-MFA)](https://aclanthology.org/2025.iwclul-1.1/).

- Arene. (2026). [Arene's recommendations on the use of artificial intelligence for universities of applied sciences](https://arene.fi/wp-content/uploads/2026/05/Arenes-recommendations-on-the-use-of-artificial-intelligence-for-universities-of-applied-sciences.pdf).

- Arene. (2026). [The Traffic Light Model](https://arene.fi/wp-content/uploads/2026/05/AI_The-Traffic-Light-Model_Arene.pdf).

---