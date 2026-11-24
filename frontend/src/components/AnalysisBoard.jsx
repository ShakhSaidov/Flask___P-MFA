import React, { useState } from "react";

function coverageClass(cov) {
  if (cov === "Explicitly Evidenced") return "pill cov-strong";
  if (cov === "Implicit / Unverified") return "pill cov-partial";
  return "pill cov-missing";
}

export default function AnalysisBoard({
  form,
  analysis,
  isAnalysisStale,
  piiMaskedCount,
  activeProvider,
  onBackToSetup,
  onUpdateFactorCoverage,
  onUpdateCheckpoint,
  onUpdateDisclosure,
  onExportMarkdown,
  exportedMarkdown,
  onOpenStudentPreview,
}) {
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!analysis) return null;

  const alert = analysis.misalignment_alert || {};
  const alertClass =
    alert.status === "Well Aligned"
      ? "cov-strong"
      : alert.status === "Review Recommended"
      ? "cov-partial"
      : "cov-missing";

  const providerLabel = activeProvider === "ollama" ? "local Ollama" : "external model";

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExportMarkdown();
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    if (!exportedMarkdown || !navigator.clipboard) return;
    await navigator.clipboard.writeText(exportedMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="panel stack-xl">
      {isAnalysisStale && (
        <div className="warn-banner row-between">
          <span>
            Assignment inputs changed after this review. Re-analyze in Setup before exporting or running Student Preview.
          </span>
          <button type="button" className="btn-secondary" onClick={onBackToSetup}>
            Re-analyze in Setup
          </button>
        </div>
      )}

      {piiMaskedCount > 0 && (
        <div className="info-banner">
          Best-effort check masked <strong>{piiMaskedCount}</strong> obvious identifier(s) before {providerLabel} processing.
        </div>
      )}

      {/* 1. Alignment Summary */}
      <section className="board-section-flat">
        <div className="row-between">
          <div>
            <span className="eyebrow">
              {form.title} · Arene {form.arene_tier.toUpperCase()}
            </span>
            <h2 className="section-title" style={{ marginTop: 2 }}>
              Constructive Alignment Observations
            </h2>
          </div>
          <div className="btn-row">
            <span className={`pill ${alertClass}`}>{alert.status}</span>
            <button type="button" className="btn-secondary" onClick={onBackToSetup}>
              Edit Inputs
            </button>
          </div>
        </div>

        <p className="lead-copy">{alert.summary}</p>
        {Array.isArray(alert.specific_gaps) && alert.specific_gaps.length > 0 && (
          <ul className="gap-list">
            {alert.specific_gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        )}
      </section>

      {/* 2. Six P-MFA Factors */}
      <section className="board-section">
        <div>
          <h3 className="section-title">Six-Factor P-MFA Coverage</h3>
          <p className="section-sub">
            Preliminary observations on assignment design, not student grades. Adjust any coverage label to match your judgment.
          </p>
        </div>

        <div className="factors-grid">
          {(analysis.factors || []).map((f, idx) => (
            <div key={f.name || idx} className="factor-card">
              <div className="factor-top">
                <div className="row-between">
                  <strong className="factor-name">{f.name}</strong>
                  <span className={coverageClass(f.coverage)}>{f.coverage}</span>
                </div>
                {f.evidence_basis && (
                  <p className="factor-evidence">
                    <span className="factor-kicker">Evidence basis:</span> {f.evidence_basis}
                  </p>
                )}
                <p className="factor-text">
                  <span className="factor-kicker">Observation:</span> {f.diagnosis}
                </p>
                <p className="factor-rec">
                  <span className="factor-kicker">Suggestion:</span> {f.recommendation}
                </p>
              </div>
              <div className="override-row">
                <label htmlFor={`override-${idx}`} className="override-label">
                  Teacher judgment:
                </label>
                <select
                  id={`override-${idx}`}
                  className="override-select"
                  value={f.coverage}
                  onChange={(e) => onUpdateFactorCoverage(idx, e.target.value)}
                >
                  <option value="Explicitly Evidenced">Explicitly Evidenced</option>
                  <option value="Implicit / Unverified">Implicit / Unverified</option>
                  <option value="Not Captured">Not Captured</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Progressive Process Checkpoints (Full-Width Timeline) */}
      <section className="board-section">
        <div className="row-between">
          <div>
            <h3 className="section-title">Process Checkpoints (Editable Progression)</h3>
            <p className="section-sub">
              Three staged milestones to make student progress observable over time. Edit any field directly.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={onOpenStudentPreview}
            disabled={isAnalysisStale}
          >
            Preview Student View →
          </button>
        </div>

        <div className="timeline-list">
          {(analysis.proposed_checkpoints || []).map((cp, idx) => (
            <div key={idx} className="timeline-item">
              <div className="timeline-marker" aria-hidden="true">
                {idx + 1}
              </div>

              <div className="cp-card-wide">
                <div className="cp-header-grid">
                  <div className="field-group">
                    <label htmlFor={`cp-title-${idx}`}>Checkpoint {idx + 1} Title</label>
                    <input
                      id={`cp-title-${idx}`}
                      type="text"
                      className="inline-input"
                      value={cp.title}
                      onChange={(e) => onUpdateCheckpoint(idx, "title", e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor={`cp-timing-${idx}`}>Timing</label>
                    <input
                      id={`cp-timing-${idx}`}
                      type="text"
                      className="inline-input"
                      value={cp.timing}
                      onChange={(e) => onUpdateCheckpoint(idx, "timing", e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor={`cp-artifact-${idx}`}>Suggested Evidence Artifact</label>
                    <input
                      id={`cp-artifact-${idx}`}
                      type="text"
                      className="inline-input"
                      value={cp.evidence_artifact}
                      onChange={(e) => onUpdateCheckpoint(idx, "evidence_artifact", e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="field-group">
                    <label htmlFor={`cp-prompt-${idx}`}>Student Task Prompt</label>
                    <textarea
                      id={`cp-prompt-${idx}`}
                      rows={4}
                      className="inline-input cp-textarea"
                      value={cp.student_prompt}
                      onChange={(e) => onUpdateCheckpoint(idx, "student_prompt", e.target.value)}
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor={`cp-reflection-${idx}`}>Self-Evaluation / Reflection Question</label>
                    <textarea
                      id={`cp-reflection-${idx}`}
                      rows={4}
                      className="inline-input cp-textarea"
                      value={cp.reflection_question}
                      onChange={(e) => onUpdateCheckpoint(idx, "reflection_question", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Disclosure & Export */}
      <section className="board-section">
        <label htmlFor="disclosure-note" className="section-title" style={{ display: "block" }}>
          Student AI Disclosure Policy
        </label>
        <p className="section-sub" style={{ marginBottom: 12 }}>
          Review the policy statement, then download your edited blueprint (including original instructions, factor labels, and checkpoints).
        </p>

        <textarea
          id="disclosure-note"
          rows={3}
          style={{ minHeight: 88 }}
          value={analysis.arene_disclosure_note || ""}
          onChange={(e) => onUpdateDisclosure(e.target.value)}
        />

        <div className="row-between" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onOpenStudentPreview}
            disabled={isAnalysisStale}
          >
            Preview Student View
          </button>
          <div className="btn-row">
            {exportedMarkdown && (
              <button type="button" className="btn-secondary" onClick={handleCopy}>
                {copied ? "Copied" : "Copy Markdown"}
              </button>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={handleExport}
              disabled={exporting || isAnalysisStale}
            >
              {exporting ? "Preparing Blueprint..." : "Download Blueprint (.md)"}
            </button>
          </div>
        </div>

        {exportedMarkdown && (
          <details className="export-details">
            <summary>View exported Markdown (pmfa-assessment-blueprint.md)</summary>
            <pre className="export-pre">{exportedMarkdown}</pre>
          </details>
        )}
      </section>
    </div>
  );
}
