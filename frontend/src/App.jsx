import React, { useEffect, useState } from "react";
import AssignmentForm from "./components/AssignmentForm.jsx";
import AnalysisBoard from "./components/AnalysisBoard.jsx";
import StudentPreview from "./components/StudentPreview.jsx";

export default function App() {
  const [samples, setSamples] = useState([]);
  const [activeSampleId, setActiveSampleId] = useState("");
  const [areneTiers, setAreneTiers] = useState({});
  const [evidenceFormats, setEvidenceFormats] = useState([]);
  const [activeProvider, setActiveProvider] = useState("groq");
  const [step, setStep] = useState("setup"); // "setup" | "review" | "student"

  const [form, setForm] = useState({
    title: "",
    learning_outcomes: "",
    assignment_text: "",
    arene_tier: "blue",
    custom_ai_rules: "",
  });
  const [sampleStudentDraft, setSampleStudentDraft] = useState("");
  const [sampleAiDisclosure, setSampleAiDisclosure] = useState("");

  const [analysis, setAnalysis] = useState(null);
  const [analysisVersion, setAnalysisVersion] = useState(0);
  const [isAnalysisStale, setIsAnalysisStale] = useState(false);
  const [piiMaskedCount, setPiiMaskedCount] = useState(0);
  const [exportedMarkdown, setExportedMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/examples")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load examples");
        return res.json();
      })
      .then((data) => {
        setSamples(data.samples || []);
        setAreneTiers(data.arene_tiers || {});
        setEvidenceFormats(data.evidence_formats || []);
        if (data.active_provider) {
          setActiveProvider(data.active_provider);
        }
        if (data.samples && data.samples.length > 0) {
          const first = data.samples[0];
          setActiveSampleId(first.id);
          setForm({
            title: first.title,
            learning_outcomes: first.learning_outcomes,
            assignment_text: first.assignment_text,
            arene_tier: first.arene_tier,
            custom_ai_rules: first.custom_ai_rules || "",
          });
          setSampleStudentDraft(first.sample_student_draft || "");
          setSampleAiDisclosure(first.sample_ai_disclosure || "");
        }
      })
      .catch(() => setError("Could not load backend presets. Verify Flask is running."));
  }, []);

  const handleUpdateForm = (updater) => {
    setForm((prev) =>
      typeof updater === "function" ? updater(prev) : updater
    );

    setActiveSampleId("");
    setSampleStudentDraft("");
    setSampleAiDisclosure("");

    if (analysis) {
      setIsAnalysisStale(true);
      setExportedMarkdown("");
    }
  };

  const handleSelectSample = (sample) => {
    setActiveSampleId(sample.id);
    setForm({
      title: sample.title,
      learning_outcomes: sample.learning_outcomes,
      assignment_text: sample.assignment_text,
      arene_tier: sample.arene_tier,
      custom_ai_rules: sample.custom_ai_rules || "",
    });
    setSampleStudentDraft(sample.sample_student_draft || "");
    setSampleAiDisclosure(sample.sample_ai_disclosure || "");
    setAnalysis(null);
    setIsAnalysisStale(false);
    setExportedMarkdown("");
    setError("");
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setExportedMarkdown("");
    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "Analysis failed.");
      } else {
        setAnalysis(data.analysis);
        setAnalysisVersion((prev) => prev + 1);
        setIsAnalysisStale(false);
        setPiiMaskedCount(data.pii_masked_count || 0);
        setStep("review");
      }
    } catch {
      setError("Network error contacting Flask backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFactorCoverage = (index, newCoverage) => {
    setExportedMarkdown("");
    setAnalysis((prev) => ({
      ...prev,
      factors: prev.factors.map((f, i) => (i === index ? { ...f, coverage: newCoverage } : f)),
    }));
  };

  const handleUpdateCheckpoint = (index, field, value) => {
    setExportedMarkdown("");
    setAnalysis((prev) => ({
      ...prev,
      proposed_checkpoints: prev.proposed_checkpoints.map((cp, i) =>
        i === index ? { ...cp, [field]: value } : cp
      ),
    }));
  };

  const handleUpdateDisclosure = (value) => {
    setExportedMarkdown("");
    setAnalysis((prev) => ({ ...prev, arene_disclosure_note: value }));
  };

  const handleExportMarkdown = async () => {
    if (isAnalysisStale) return;
    setError("");
    try {
      const resp = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          arene_tier: form.arene_tier,
          custom_ai_rules: form.custom_ai_rules,
          learning_outcomes: form.learning_outcomes,
          assignment_text: form.assignment_text,
          analysis,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "Export failed.");
        return;
      }
      setExportedMarkdown(data.markdown);

      const blob = new Blob([data.markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename || "pmfa-assessment-blueprint.md";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Network error exporting blueprint.");
    }
  };

  return (
    <div>
      <header className="topbar">
        <div className="topbar-accent" />
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-title-row">
              <h1>P-MFA Studio</h1>
              <span className="proto-tag">R&amp;D Prototype</span>
            </div>
            <p>Process-oriented assignment design inspired by Hämäläinen &amp; Leiviskä (2025)</p>
          </div>

          <nav className="stepper" aria-label="Workflow steps">
            <button
              type="button"
              className={`step-btn ${step === "setup" ? "active" : ""}`}
              onClick={() => setStep("setup")}
            >
              1. Setup
            </button>
            <button
              type="button"
              className={`step-btn ${step === "review" ? "active" : ""}`}
              disabled={!analysis}
              onClick={() => setStep("review")}
            >
              2. Design Review
            </button>
            <button
              type="button"
              className={`step-btn ${step === "student" ? "active" : ""}`}
              disabled={!analysis || isAnalysisStale}
              onClick={() => setStep("student")}
            >
              3. Student Preview
            </button>
          </nav>
        </div>
      </header>

      <main className="container">
        {error && <div className="error-banner">{error}</div>}

        {step === "setup" && (
          <AssignmentForm
            form={form}
            setForm={handleUpdateForm}
            samples={samples}
            activeSampleId={activeSampleId}
            areneTiers={areneTiers}
            activeProvider={activeProvider}
            loading={loading}
            onSelectSample={handleSelectSample}
            onSubmit={handleAnalyze}
          />
        )}

        {step === "review" && (
          <AnalysisBoard
            form={form}
            analysis={analysis}
            isAnalysisStale={isAnalysisStale}
            piiMaskedCount={piiMaskedCount}
            activeProvider={activeProvider}
            onBackToSetup={() => setStep("setup")}
            onUpdateFactorCoverage={handleUpdateFactorCoverage}
            onUpdateCheckpoint={handleUpdateCheckpoint}
            onUpdateDisclosure={handleUpdateDisclosure}
            onExportMarkdown={handleExportMarkdown}
            exportedMarkdown={exportedMarkdown}
            onOpenStudentPreview={() => setStep("student")}
          />
        )}

        {analysis && (
          <div hidden={step !== "student"}>
            <StudentPreview
              key={analysisVersion}
              form={form}
              analysis={analysis}
              isAnalysisStale={isAnalysisStale}
              areneTiers={areneTiers}
              evidenceFormats={evidenceFormats}
              activeProvider={activeProvider}
              sampleStudentDraft={sampleStudentDraft}
              sampleAiDisclosure={sampleAiDisclosure}
              onBackToReview={() => setStep("review")}
              onBackToSetup={() => setStep("setup")}
            />
          </div>
        )}
      </main>
    </div>
  );
}
