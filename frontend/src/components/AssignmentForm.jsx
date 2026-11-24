import React from "react";

const TIER_ORDER = ["blue", "green", "yellow", "red"];

const TIER_SHORT = {
  blue: { title: "Blue — AI Required", desc: "Students must use AI and report how it was used." },
  green: { title: "Green — AI Allowed", desc: "Allowed within course instructions; no reporting required." },
  yellow: { title: "Yellow — AI Reported", desc: "AI allowed within your rules; students must report use." },
  red: { title: "Red — AI Prohibited", desc: "AI cannot be used to produce the assessed work. Any permitted preparatory use follows the lecturer's instructions." },
};

export default function AssignmentForm({
  form,
  setForm,
  samples,
  activeSampleId,
  areneTiers,
  activeProvider,
  loading,
  onSelectSample,
  onSubmit,
}) {
  const providerLabel = activeProvider === "ollama" ? "local Ollama" : "Groq API";

  return (
    <form className="panel stack-xl" onSubmit={onSubmit}>
      <section className="board-section-flat">
        <h2 className="section-title">1. Assignment &amp; Learning Outcomes</h2>
        <p className="section-sub">
          Enter your existing assignment or load an illustrative synthetic scenario to check P-MFA coverage and draft process checkpoints.
        </p>

        <div className="preset-bar">
          <span className="preset-label">Illustrative scenarios:</span>
          {samples.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`preset-pill ${activeSampleId === s.id ? "active" : ""}`}
              onClick={() => onSelectSample(s)}
            >
              {s.school} · {s.arene_tier.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="stack-lg">
          <div className="field-group">
            <label htmlFor="title">Assignment Title</label>
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Impact of Artificial Intelligence on Healthcare"
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="field-group">
              <label htmlFor="outcomes">Stated Learning Outcomes</label>
              <textarea
                id="outcomes"
                rows={5}
                value={form.learning_outcomes}
                onChange={(e) => setForm({ ...form, learning_outcomes: e.target.value })}
                placeholder="What must students demonstrate by the end of this assignment?"
                required
              />
            </div>

            <div className="field-group">
              <label htmlFor="assignment">Current Assignment Instructions</label>
              <textarea
                id="assignment"
                rows={5}
                value={form.assignment_text}
                onChange={(e) => setForm({ ...form, assignment_text: e.target.value })}
                placeholder="Paste the existing task prompt, length, and deliverable format..."
                required
              />
            </div>
          </div>
        </div>
      </section>

      <section className="board-section stack-lg">
        <div>
          <h3 className="section-title">2. Student AI Policy (Arene Traffic Light)</h3>
          <p className="section-sub">
            Defines what students are permitted to do in this assignment. Does not restrict teacher planning.
          </p>
        </div>

        <div className="arene-grid">
          {TIER_ORDER.filter((key) => areneTiers[key]).map((key) => {
            const info = areneTiers[key];
            const short = TIER_SHORT[key] || { title: info.label, desc: info.rule };
            return (
              <button
                key={key}
                type="button"
                className={`arene-card ${form.arene_tier === key ? "selected" : ""}`}
                onClick={() => setForm({ ...form, arene_tier: key })}
              >
                <div className="arene-title">
                  <span className="dot" style={{ background: info.badge }} />
                  <span>{short.title}</span>
                </div>
                <div className="arene-desc">{short.desc}</div>
              </button>
            );
          })}
        </div>

        <div className="field-group">
          <label htmlFor="custom-rules">Course-Specific AI Boundaries (Optional)</label>
          <input
            id="custom-rules"
            type="text"
            value={form.custom_ai_rules}
            onChange={(e) => setForm({ ...form, custom_ai_rules: e.target.value })}
            placeholder="e.g., AI allowed for keyword search; prohibited for critical appraisal"
          />
        </div>

        <div className="row-between">
          <span className="privacy-foot">
            Use synthetic examples only. Best-effort regex masks obvious emails, phone numbers, and Finnish IDs before model processing ({providerLabel}); this is not anonymisation.
          </span>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Analyzing Design..." : "Analyze Assignment Design →"}
          </button>
        </div>
      </section>
    </form>
  );
}
