import React from "react";

const TIER_ORDER = ["blue", "green", "yellow", "red"];

const TIER_SHORT = {
  blue: { title: "Blue · AI Required", desc: "Students must use AI and explain how." },
  green: { title: "Green · AI Allowed", desc: "AI is allowed. No report needed." },
  yellow: { title: "Yellow · AI With Rules", desc: "AI allowed under your rules. Must be reported." },
  red: { title: "Red · No AI", desc: "No AI for graded work. Student works independently." },
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
        <h2 className="section-title">1. Describe Your Assignment</h2>
        <p className="section-sub">
          Paste your task below or click a sample to see where AI could bypass learning and generate 3 checkpoints.
        </p>

        <div className="preset-bar">
          <span className="preset-label">Try a sample:</span>
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
              <label htmlFor="outcomes">Learning Outcomes</label>
              <textarea
                id="outcomes"
                rows={5}
                value={form.learning_outcomes}
                onChange={(e) => setForm({ ...form, learning_outcomes: e.target.value })}
                placeholder="What should students actually know or be able to do by the end?"
                required
              />
            </div>

            <div className="field-group">
              <label htmlFor="assignment">Assignment Prompt</label>
              <textarea
                id="assignment"
                rows={5}
                value={form.assignment_text}
                onChange={(e) => setForm({ ...form, assignment_text: e.target.value })}
                placeholder="Paste the task instructions, length, and what students submit..."
                required
              />
            </div>
          </div>
        </div>
      </section>

      <section className="board-section stack-lg">
        <div>
          <h3 className="section-title">2. Student AI Rules (Arene Traffic Light)</h3>
          <p className="section-sub">
            Pick what students may do with AI in this task.
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
          <label htmlFor="custom-rules">Extra AI Rules for This Task (Optional)</label>
          <input
            id="custom-rules"
            type="text"
            value={form.custom_ai_rules}
            onChange={(e) => setForm({ ...form, custom_ai_rules: e.target.value })}
            placeholder="e.g., AI allowed for keyword search; not allowed for critical appraisal"
          />
        </div>

        <div className="row-between">
          <span className="privacy-foot">
            Demo only: use fictional examples, no real student data. Emails, phone numbers, and Finnish IDs are automatically hidden before sending to {providerLabel}.
          </span>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Checking assignment..." : "Check Assignment →"}
          </button>
        </div>
      </section>
    </form>
  );
}
