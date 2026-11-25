import React from "react";

const TIER_ORDER = ["blue", "green", "yellow", "red"];

export default function AssignmentForm({
  form,
  setForm,
  samples,
  activeSampleId,
  areneTiers,
  activeProvider,
  loading,
  analyzeError = "",
  onSelectSample,
  onClearForm,
  onSubmit,
}) {
  const providerLabel = activeProvider === "ollama" ? "local Ollama" : "Groq API";

  return (
    <form className="panel" onSubmit={onSubmit}>
      <fieldset disabled={loading} className="fieldset-reset stack-xl">
        <section className="board-section-flat">
          <h2 className="section-title">Assignment Details</h2>
          <p className="section-sub">
            Enter your assignment brief or load a synthetic sample to audit constructive alignment and draft 3 checkpoints.
          </p>

          <div className="preset-bar">
            <span className="preset-label">Load sample:</span>
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
            {onClearForm && (
              <button type="button" className="preset-pill preset-pill-ghost" onClick={onClearForm}>
                Blank form
              </button>
            )}
          </div>

          <div className="stack-lg">
            <div className="field-group">
              <label htmlFor="title">Assignment Title</label>
              <input
                id="title"
                type="text"
                maxLength={400}
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
                  maxLength={4000}
                  value={form.learning_outcomes}
                  onChange={(e) => setForm({ ...form, learning_outcomes: e.target.value })}
                  placeholder="What should students know or demonstrate by the end?"
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="assignment">Assignment Prompt</label>
                <textarea
                  id="assignment"
                  rows={5}
                  maxLength={4000}
                  value={form.assignment_text}
                  onChange={(e) => setForm({ ...form, assignment_text: e.target.value })}
                  placeholder="Paste the task instructions, deliverables, and deadline structure..."
                  required
                />
              </div>
            </div>
          </div>
        </section>

        <section className="board-section stack-lg">
          <div>
            <h3 className="section-title">Student AI Policy (Arene Traffic Light)</h3>
            <p className="section-sub">
              Select how students may use AI in this assignment.
            </p>
          </div>

          <div className="arene-grid" role="group" aria-label="Arene AI tier">
            {TIER_ORDER.filter((key) => areneTiers[key]).map((key) => {
              const info = areneTiers[key];
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={form.arene_tier === key}
                  className={`arene-card ${form.arene_tier === key ? "selected" : ""}`}
                  onClick={() => setForm({ ...form, arene_tier: key })}
                >
                  <div className="arene-title">
                    <span className="dot" style={{ background: info.badge }} />
                    <span>{info.short_title || info.label}</span>
                  </div>
                  <div className="arene-desc">{info.short_desc || info.rule}</div>
                </button>
              );
            })}
          </div>

          <div className="field-group">
            <label htmlFor="custom-rules">Course-Specific AI Boundaries (Optional)</label>
            <input
              id="custom-rules"
              type="text"
              maxLength={4000}
              value={form.custom_ai_rules}
              onChange={(e) => setForm({ ...form, custom_ai_rules: e.target.value })}
              placeholder="e.g., AI allowed for keyword search; critical appraisal must be written independently"
            />
          </div>

          <div className="row-between">
            {loading ? (
              <span className="status-inline" role="status" aria-live="polite">
                <span className="spinner" aria-hidden="true" />
                <span>
                  {activeProvider === "ollama"
                    ? "Auditing constructive alignment via local Ollama (may take up to a minute)..."
                    : "Auditing constructive alignment via Groq API (usually 5–20 seconds)..."}
                </span>
              </span>
            ) : (
              <span className="privacy-foot">
                Demo only: use synthetic examples, not real student data. Emails, phone numbers, and Finnish personal IDs are masked before sending to {providerLabel}.
              </span>
            )}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Analyzing Assignment..." : "Analyze Assignment →"}
            </button>
          </div>

          {analyzeError && (
            <div className="error-banner" role="alert" style={{ marginBottom: 0 }}>
              {analyzeError}
            </div>
          )}
        </section>
      </fieldset>
    </form>
  );
}