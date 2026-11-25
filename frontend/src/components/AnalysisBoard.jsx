import React, { useState } from "react";

const COVERAGE_LABELS = {
  "Explicitly Evidenced": "Clearly Covered",
  "Implicit / Unverified": "Assumed / Unchecked",
  "Not Captured": "Missing",
};

const STATUS_LABELS = {
  "Well Aligned": "Well Aligned",
  "Review Recommended": "Needs Review",
  "Potential Alignment Gap": "Gap Found",
};

const REQUIRED_CHECKPOINT_FIELDS = [
  "title",
  "timing",
  "evidence_artifact",
  "student_prompt",
  "reflection_question",
];

function coverageClass(cov) {
  if (cov === "Explicitly Evidenced") return "pill cov-strong";
  if (cov === "Implicit / Unverified") return "pill cov-partial";
  return "pill cov-missing";
}

function factorRowClass(cov) {
  if (cov === "Explicitly Evidenced") return "factor-row factor-row-strong";
  if (cov === "Implicit / Unverified") return "factor-row factor-row-partial";
  return "factor-row factor-row-missing";
}

function isEmptyField(cp, field) {
  return typeof cp?.[field] !== "string" || !cp[field].trim();
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
  exportError = "",
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
  const statusLabel = STATUS_LABELS[alert.status] || alert.status;
  const providerLabel = activeProvider === "ollama" ? "local Ollama" : "external AI";

  const incompleteCheckpointNumbers = (analysis.proposed_checkpoints || []).reduce(
    (missing, checkpoint, index) => {
      if (REQUIRED_CHECKPOINT_FIELDS.some((field) => isEmptyField(checkpoint, field))) {
        missing.push(index + 1);
      }
      return missing;
    },
    []
  );

  const hasIncompleteCheckpoints = incompleteCheckpointNumbers.length > 0;
  const isDisclosureEmpty =
    typeof analysis.arene_disclosure_note !== "string" ||
    !analysis.arene_disclosure_note.trim();
  const isActionBlocked =
    isAnalysisStale || hasIncompleteCheckpoints || isDisclosureEmpty;

  const handleExport = async (shouldDownload = true) => {
    setExporting(true);
    try {
      await onExportMarkdown(shouldDownload);
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    if (!exportedMarkdown || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(exportedMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  return (
    <div className="panel stack-xl">
      {isAnalysisStale && (
        <div className="warn-banner row-between">
          <span>
            The assignment details changed. Re-run the alignment check before exporting or opening Student View.
          </span>
          <button type="button" className="btn-secondary" onClick={onBackToSetup}>
            Re-run Check
          </button>
        </div>
      )}

      {piiMaskedCount > 0 && (
        <div className="info-banner">
          Privacy check masked <strong>{piiMaskedCount}</strong> identifier(s) (email, phone, or Finnish ID) before sending to {providerLabel}.
        </div>
      )}

      {/* 1. Alignment Summary */}
      <section className="board-section-flat">
        <div className="row-between row-between-top">
          <div className="row-head-copy">
            <span className="eyebrow">
              {form.title} · Arene {form.arene_tier.toUpperCase()}
            </span>
            <h2 className="section-title" style={{ marginTop: 2 }}>
              Alignment Check
            </h2>
            <p className="section-sub">
              Preliminary check of how well the task and deliverable evidence the learning outcomes.
            </p>
          </div>
          <div className="btn-row card-header-side">
            <span className={`pill ${alertClass}`}>{statusLabel}</span>
            <button type="button" className="btn-secondary" onClick={onBackToSetup}>
              Edit Assignment
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

      {/* 2. Six P-MFA Dimensions */}
      <section className="board-section">
        <div>
          <h3 className="section-title">Six P-MFA Dimensions</h3>
          <p className="section-sub">
            What the prompt explicitly verifies versus what a polished final submission could mask. Adjust any rating as needed.
          </p>
        </div>

        <div className="factors-list">
          {(analysis.factors || []).map((f, idx) => (
            <div key={f.name || idx} className={factorRowClass(f.coverage)}>
              <div className="factor-row-head">
                <div className="factor-row-title">
                  <strong className="factor-name">{f.name}</strong>
                  <span className={coverageClass(f.coverage)}>
                    {COVERAGE_LABELS[f.coverage] || f.coverage}
                  </span>
                </div>

                <div className="factor-row-control">
                  <label htmlFor={`override-${idx}`} className="override-label">
                    Your rating:
                  </label>
                  <select
                    id={`override-${idx}`}
                    className="override-select"
                    value={f.coverage}
                    onChange={(e) => onUpdateFactorCoverage(idx, e.target.value)}
                  >
                    <option value="Explicitly Evidenced">Clearly Covered</option>
                    <option value="Implicit / Unverified">Assumed / Unchecked</option>
                    <option value="Not Captured">Missing</option>
                  </select>
                </div>
              </div>

              {f.evidence_basis && (
                <p className="factor-evidence">
                  <span className="factor-kicker">In prompt:</span> {f.evidence_basis}
                </p>
              )}

              <div className="factor-row-cols">
                <p className="factor-text">
                  <span className="factor-kicker">Observation:</span> {f.diagnosis}
                </p>
                <p className="factor-rec">
                  <span className="factor-kicker">Suggested fix:</span> {f.recommendation}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Checkpoints */}
      <section className="board-section">
        <div>
          <h3 className="section-title">Three Process Checkpoints</h3>
          <p className="section-sub">
            Staged milestones making student reasoning observable before the final deadline. All fields are editable.
          </p>
        </div>

        {hasIncompleteCheckpoints && (
          <div className="warn-banner" role="alert" style={{ marginTop: 14 }}>
            <strong>Incomplete checkpoints:</strong>{" "}
            Complete all five required fields in checkpoint(s){" "}
            {incompleteCheckpointNumbers.join(", ")} before exporting the plan or opening Student View.
          </div>
        )}

        <div className="timeline-list">
          {(analysis.proposed_checkpoints || []).map((cp, idx) => (
            <div key={`cp-${idx}`} className="timeline-item">
              <div className="timeline-marker" aria-hidden="true">
                {idx + 1}
              </div>

              <div className="cp-card-wide">
                <div className="cp-meta-grid">
                  <div className="field-group">
                    <label htmlFor={`cp-title-${idx}`}>Checkpoint {idx + 1} Title</label>
                    <input
                      id={`cp-title-${idx}`}
                      type="text"
                      maxLength={4000}
                      aria-invalid={isEmptyField(cp, "title")}
                      className={`inline-input ${isEmptyField(cp, "title") ? "input-invalid" : ""}`}
                      value={cp.title}
                      onChange={(e) => onUpdateCheckpoint(idx, "title", e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor={`cp-timing-${idx}`}>When</label>
                    <input
                      id={`cp-timing-${idx}`}
                      type="text"
                      maxLength={4000}
                      aria-invalid={isEmptyField(cp, "timing")}
                      className={`inline-input ${isEmptyField(cp, "timing") ? "input-invalid" : ""}`}
                      value={cp.timing}
                      onChange={(e) => onUpdateCheckpoint(idx, "timing", e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label htmlFor={`cp-artifact-${idx}`}>What Students Hand In</label>
                  <textarea
                    id={`cp-artifact-${idx}`}
                    rows={2}
                    maxLength={4000}
                    aria-invalid={isEmptyField(cp, "evidence_artifact")}
                    className={`inline-input cp-artifact-textarea ${
                      isEmptyField(cp, "evidence_artifact") ? "input-invalid" : ""
                    }`}
                    value={cp.evidence_artifact}
                    onChange={(e) => onUpdateCheckpoint(idx, "evidence_artifact", e.target.value)}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="field-group">
                    <label htmlFor={`cp-prompt-${idx}`}>Instructions for Students</label>
                    <textarea
                      id={`cp-prompt-${idx}`}
                      rows={4}
                      maxLength={4000}
                      aria-invalid={isEmptyField(cp, "student_prompt")}
                      className={`inline-input cp-textarea ${
                        isEmptyField(cp, "student_prompt") ? "input-invalid" : ""
                      }`}
                      value={cp.student_prompt}
                      onChange={(e) => onUpdateCheckpoint(idx, "student_prompt", e.target.value)}
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor={`cp-reflection-${idx}`}>Reflection Question</label>
                    <textarea
                      id={`cp-reflection-${idx}`}
                      rows={4}
                      maxLength={4000}
                      aria-invalid={isEmptyField(cp, "reflection_question")}
                      className={`inline-input cp-textarea ${
                        isEmptyField(cp, "reflection_question") ? "input-invalid" : ""
                      }`}
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

      {/* 4. AI Rule & Export */}
      <section className="board-section">
        <label htmlFor="disclosure-note" className="section-title" style={{ display: "block" }}>
          Student AI Policy &amp; Disclosure Draft
        </label>
        <p className="section-sub" style={{ marginBottom: 12 }}>
          Review or edit the guidance shown to students in Student View and included in your exported Markdown blueprint.
        </p>

        <textarea
          id="disclosure-note"
          rows={3}
          maxLength={4000}
          aria-invalid={isDisclosureEmpty}
          className={isDisclosureEmpty ? "input-invalid" : ""}
          style={{ minHeight: 88 }}
          value={analysis.arene_disclosure_note || ""}
          onChange={(e) => onUpdateDisclosure(e.target.value)}
        />

        {isDisclosureEmpty && (
          <div className="warn-banner" role="alert" style={{ marginTop: 10 }}>
            <strong>Disclosure guidance required:</strong>{" "}
            Enter a student AI policy &amp; disclosure rule before exporting or opening Student View.
          </div>
        )}

        <div className="row-between" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onOpenStudentPreview}
            disabled={isActionBlocked}
          >
            Test Student View →
          </button>
          <div className="btn-row">
            {!exportedMarkdown && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleExport(false)}
                disabled={exporting || isActionBlocked}
              >
                {exporting ? "Preparing..." : "Preview Markdown"}
              </button>
            )}
            {exportedMarkdown && (
              <button type="button" className="btn-secondary" onClick={handleCopy}>
                {copied ? "Copied" : "Copy Markdown"}
              </button>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleExport(true)}
              disabled={exporting || isActionBlocked}
            >
              {exporting ? "Creating Plan..." : "Download Plan (.md)"}
            </button>
          </div>
        </div>

        {exportError && (
          <div className="error-banner" role="alert" style={{ marginTop: 12, marginBottom: 0 }}>
            {exportError}
          </div>
        )}

        {exportedMarkdown && (
          <details className="export-details" open>
            <summary>Markdown blueprint preview (pmfa-assessment-blueprint.md)</summary>
            <pre className="export-pre">{exportedMarkdown}</pre>
          </details>
        )}
      </section>
    </div>
  );
}