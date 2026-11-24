import React, { useEffect, useState } from "react";
import AssignmentForm from "./components/AssignmentForm.jsx";
import AnalysisBoard from "./components/AnalysisBoard.jsx";
import StudentPreview from "./components/StudentPreview.jsx";

const FALLBACK_ARENE_TIERS = {
  blue: {
    label: "Blue — AI Required & Reported",
    badge: "#1d4ed8",
    student_ai_enabled: true,
    requires_disclosure: true,
    rule: "Students must use AI in the assignment and report how AI outputs were prompted, evaluated, and verified.",
  },

  green: {
    label: "Green — AI Allowed (No Reporting Needed)",
    badge: "#15803d",
    student_ai_enabled: true,
    requires_disclosure: false,
    rule: "AI use is allowed within the assignment and course instructions. No AI-use report is required.",
  },

  yellow: {
    label: "Yellow — AI Allowed Within Bounds & Reported",
    badge: "#b45309",
    student_ai_enabled: true,
    requires_disclosure: true,
    rule: "Students may use AI within teacher-defined boundaries and must document and reflect on its use. AI can never be the author.",
  },

  red: {
    label: "Red — AI Prohibited",
    badge: "#b91c1c",
    student_ai_enabled: false,
    requires_disclosure: false,
    rule: "AI must not be used to create the assessed output. Any permitted preparatory use must follow the lecturer's course-specific instructions. This prototype disables its own AI-assisted student coaching under the Red tier. Assessment relies on staged process evidence and controlled or oral verification.",
  },
};

export default function App() {
  const [samples, setSamples] = useState([]);
  const [activeSampleId, setActiveSampleId] = useState("");
  const [areneTiers, setAreneTiers] = useState(FALLBACK_ARENE_TIERS);
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
        setAreneTiers(
          data.arene_tiers && Object.keys(data.arene_tiers).length > 0
            ? data.arene_tiers
            : FALLBACK_ARENE_TIERS
        );
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
      .catch(() => setError("Could not load sample presets. Check that Flask is running."));
  }, []);

  const goToStep = (nextStep) => {
    setError("");
    setStep(nextStep);
  };

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
        setError(data.error || "Could not analyze the assignment.");
      } else {
        setAnalysis(data.analysis);
        setAnalysisVersion((prev) => prev + 1);
        setIsAnalysisStale(false);
        setPiiMaskedCount(data.pii_masked_count || 0);
        goToStep("review");
      }
    } catch {
      setError("Could not reach the server. Check that Flask is running.");
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
        setError(data.error || "Could not export the plan. Make sure all checkpoint fields are filled in.");
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
      setError("Could not reach the server to export your plan.");
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
              <span className="proto-tag">Metropolia R&amp;D Prototype</span>
            </div>
            <p>Spot AI blind spots in assignments and build 3 progress checkpoints</p>
          </div>

          <nav className="stepper" aria-label="Workflow steps">
            <button
              type="button"
              className={`step-btn ${step === "setup" ? "active" : ""}`}
              onClick={() => goToStep("setup")}
            >
              1. Assignment
            </button>
            <button
              type="button"
              className={`step-btn ${step === "review" ? "active" : ""}`}
              disabled={!analysis}
              onClick={() => goToStep("review")}
            >
              2. Review
            </button>
            <button
              type="button"
              className={`step-btn ${step === "student" ? "active" : ""}`}
              disabled={!analysis || isAnalysisStale}
              onClick={() => goToStep("student")}
            >
              3. Student View
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
            onBackToSetup={() => goToStep("setup")}
            onUpdateFactorCoverage={handleUpdateFactorCoverage}
            onUpdateCheckpoint={handleUpdateCheckpoint}
            onUpdateDisclosure={handleUpdateDisclosure}
            onExportMarkdown={handleExportMarkdown}
            exportedMarkdown={exportedMarkdown}
            onOpenStudentPreview={() => goToStep("student")}
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
              onBackToReview={() => goToStep("review")}
              onBackToSetup={() => goToStep("setup")}
            />
          </div>
        )}
      </main>
    </div>
  );
}
