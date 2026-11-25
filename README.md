# P-MFA Studio

A small Flask + React R&D prototype exploring **process-oriented assignment design** grounded in *Pedagogical Multi-Factor Assessment (P-MFA)* (Hämäläinen & Leiviskä, 2025) and **Metropolia / Arene AI traffic-light guidelines** (Blue, Green, Yellow, Red).

> **Prototype Scope:** P-MFA Studio is an exploratory R&D prototype inspired by selected P-MFA principles—not a validated institutional implementation, automated grading tool, or persistent LMS integration. All built-in scenarios are illustrative synthetic examples.

---

## Problem & Metropolia Context

When generative AI can produce polished final essays, reports, and code on demand, single-submission assignments suffer from a **misalignment problem**: grading solely on an end-of-course artifact loses visibility into authentic student reasoning and learning.

**P-MFA Studio** lets lecturers audit an assignment brief before a course begins and test process-based checkpoints through a three-step workflow:
1. **1. Assignment:** Enter learning outcomes, task instructions, **Arene AI Traffic Light** tier (*Blue, Green, Yellow, Red*), and optional course rules—or load one of four Metropolia-oriented synthetic presets across Technology, Culture, Health Care, and Business.
2. **2. Review:** Audits constructive alignment across the six P-MFA dimensions (*Knowledge, Outputs, Application, Process Continuity, Self-Evaluation, Situated Understanding*), anchors each rating in prompt wording (`evidence_basis`), drafts **3 editable checkpoints** plus a student AI disclosure rule, and exports a Markdown blueprint.
3. **3. Student View:** Lets users test a checkpoint check-in as a student—comparing **Socratic AI coaching** (Blue, Green, Yellow—guided by course boundaries without writing deliverables) against **deterministic server-side AI lockout** (Red).

---

## Demo Screenshots

### 1. Assignment Setup & Arene Traffic Light Selection
![Assignment Setup](docs/screenshots/01-assignment-setup.png)

### 2. Six-Factor P-MFA Alignment Audit
![Six-Factor P-MFA Audit](docs/screenshots/02-pmfa-alignment-audit.png)

### 3. Editable Process Checkpoints & Markdown Blueprint Export
![Checkpoints and Markdown Export](docs/screenshots/03-checkpoints-and-export.png)

### 4. Student View — Socratic AI Coach (Yellow Tier)
![Student Coach View](docs/screenshots/04-student-coach-yellow.png)

### 5. Student View — Deterministic Red-Tier AI Lockout
![Red Tier Lockout](docs/screenshots/05-student-red-lockout.png)

---

## Architecture & Technical Decisions

- **Backend (`backend/`):** Python Flask application factory (`backend/app.py`) serving a JSON REST API (`/api/health`, `/api/examples`, `/api/analyze`, `/api/student-checkin`, `/api/export`) and prebuilt frontend assets (`backend/static_dist/`), protected by a 64 KB payload cap and bounded per-IP rate limiting (`SimpleRateLimiter`).

---

## Local Setup & Running

### 1. Backend
```bash
python -m venv .venv
# Windows Powershell: .venv\Scripts\Activate.ps1
# Linux/macOS: source .venv/bin/activate

pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
# Add your GROQ_API_KEY to backend/.env (or set LLM_PROVIDER=ollama for local inference)
```

Start Flask from the root folder (using the prebuilt `backend/static_dist/` bundle):
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

cd frontend && npm test
```

---

## Potential R&D Questions

- Can process-based checkpoints make student competence more visible when final submissions may be AI-assisted?
- How reliably can LLMs identify gaps between learning outcomes, assignment instructions, and proposed assessment evidence?
- Which evidence formats are practical across different disciplines?
- How can AI support student reflection without replacing independent reasoning or producing assessed work?

The current prototype does not collect research data or establish the effectiveness of these approaches. These are directions for future evaluation with lecturers and students.

---

## Privacy & Limitations

- **Human review required:** AI-generated observations and prompt-evidence pointers are design suggestions, not verified proof of learning outcomes or student competence. Final pedagogical and grading judgment always rests with the lecturer.
- **Use synthetic examples only.** Do not enter real student work, names, or sensitive personal data. `pii_guard.py` is best-effort regex masking—**not** full anonymisation or GDPR compliance—and does not detect arbitrary names, addresses, or contextual sensitive facts.
- **Policy enforcement boundaries:** Only the **Red** tier deterministically blocks LLM calls on the backend. Course-specific natural-language rules (`custom_ai_rules`) and the Socratic non-writing constraint rely on prompt-guided model behaviour and cannot guarantee refusal against adversarial inputs.
- **Prototype scope:** No database, authentication, or Moodle integration. The Student View runs in-browser without saving or transmitting student drafts to instructors. Rate limiting (`SimpleRateLimiter`) is process-local for demo protection.

---

## References

- Hämäläinen, M., & Leiviskä, K. (2025). [From NLG Evaluation to Modern Student Assessment in the Era of ChatGPT: The Great Misalignment Problem and Pedagogical Multi-Factor Assessment (P-MFA)](https://aclanthology.org/2025.iwclul-1.1/).

- Arene. (2026). [Arene's recommendations on the use of artificial intelligence for universities of applied sciences](https://arene.fi/wp-content/uploads/2026/05/Arenes-recommendations-on-the-use-of-artificial-intelligence-for-universities-of-applied-sciences.pdf).

- Arene. (2026). [The Traffic Light Model](https://arene.fi/wp-content/uploads/2026/05/AI_The-Traffic-Light-Model_Arene.pdf).

---