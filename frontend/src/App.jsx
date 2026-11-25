import React, { useEffect, useRef, useState } from "react";
import { requestJson } from "./api.js";
import AssignmentForm from "./components/AssignmentForm.jsx";
import AnalysisBoard from "./components/AnalysisBoard.jsx";
import StudentPreview from "./components/StudentPreview.jsx";

const FALLBACK_ARENE_TIERS = {
  blue: {
    label: "Blue — AI Required & Reported",
    short_title: "Blue · AI Required",
    short_desc: "Students must use AI and report how they used and verified it.",
    badge: "#1d4ed8",
    student_ai_enabled: true,
    requires_disclosure: true,
    rule: "Students must use AI in the assignment and report how AI outputs were prompted, evaluated, and verified.",
  },
  green: {
    label: "Green — AI Allowed (No Reporting Needed)",
    short_title: "Green · AI Allowed",
    short_desc: "AI allowed within course instructions. No reporting required.",
    badge: "#15803d",
    student_ai_enabled: true,
    requires_disclosure: false,
    rule: "AI use is allowed within the assignment and course instructions. No AI-use report is required.",
  },
  yellow: {
    label: "Yellow — AI Allowed Within Bounds & Reported",
    short_title: "Yellow · AI With Rules",
    short_desc: "Allowed within your boundaries. Must be documented and reported.",
    badge: "#b45309",
    student_ai_enabled: true,
    requires_disclosure: true,
    rule: "Students may use AI within teacher-defined boundaries and must document and reflect on its use. AI can never be the author.",
  },
  red: {
    label: "Red — AI Prohibited",
    short_title: "Red · No AI",
    short_desc: "No AI for graded work. Relies on independent and oral/process checks.",
    badge: "#b91c1c",
    student_ai_enabled: false,
    requires_disclosure: false,
    rule: "AI must not be used to create graded work. This prototype disables AI Coach feedback under the Red tier; assessment relies on independent process evidence and oral or controlled verification.",
  },
};

const EMPTY_FORM = {
  title: "",
  learning_outcomes: "",
  assignment_text: "",
  arene_tier: "yellow",
  custom_ai_rules: "",
};

export default function App() {
  const [samples, setSamples] = useState([]);
  const [activeSampleId, setActiveSampleId] = useState("");
  const [areneTiers, setAreneTiers] = useState(FALLBACK_ARENE_TIERS);
  const [evidenceFormats, setEvidenceFormats] = useState([]);
  const [activeProvider, setActiveProvider] = useState("groq");
  const [step, setStep] = useState("setup"); // "setup" | "review" | "student"

  const [form, setForm] = useState(EMPTY_FORM);
  const [sampleStudentDraft, setSampleStudentDraft] = useState("");
  const [sampleAiDisclosure, setSampleAiDisclosure] = useState("");

  const [analysis, setAnalysis] = useState(null);
  const [analysisVersion, setAnalysisVersion] = useState(0);
  const [isAnalysisStale, setIsAnalysisStale] = useState(false);
  const [piiMaskedCount, setPiiMaskedCount] = useState(0);
  const [exportedMarkdown, setExportedMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analyzeError, setAnalyzeError] = useState("");
  const [exportError, setExportError] = useState("");
  const analyzeRequestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    requestJson("/api/examples")
      .then((data) => {
        if (cancelled) return;

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

        const first = data.samples?.[0];
        if (first) {
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
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Could not load sample presets. Check that Flask is running.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const goToStep = (nextStep) => {
    if (loading) return;
    setError("");
    setAnalyzeError("");
    setExportError("");
    setStep(nextStep);
  };

  const handleUpdateForm = (updater) => {
    if (loading) return;
    const nextForm = typeof updater === "function" ? updater(form) : updater;
    const coreTaskChanged =
      nextForm.title !== form.title ||
      nextForm.learning_outcomes !== form.learning_outcomes ||
      nextForm.assignment_text !== form.assignment_text;

    setForm(nextForm);
    setActiveSampleId("");
    setAnalyzeError("");
    if (coreTaskChanged) {
      setSampleStudentDraft("");
      setSampleAiDisclosure("");
    }
    if (analysis) {
      setIsAnalysisStale(true);
      setExportedMarkdown("");
      setExportError("");
    }
  };

  const handleSelectSample = (sample) => {
    if (loading) return;
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
    setAnalyzeError("");
    setExportError("");
  };

  const handleClearForm = () => {
    if (loading) return;
    setActiveSampleId("");
    setForm({ ...EMPTY_FORM, arene_tier: form.arene_tier });
    setSampleStudentDraft("");
    setSampleAiDisclosure("");
    setAnalysis(null);
    setIsAnalysisStale(false);
    setExportedMarkdown("");
    setError("");
    setAnalyzeError("");
    setExportError("");
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (
      !form.title.trim() ||
      !form.learning_outcomes.trim() ||
      !form.assignment_text.trim()
    ) {
      setAnalyzeError("Assignment title, learning outcomes, and assignment prompt are required.");
      return;
    }

    const requestId = ++analyzeRequestIdRef.current;
    const submittedForm = { ...form };
    setLoading(true);
    setError("");
    setAnalyzeError("");
    setExportError("");
    setExportedMarkdown("");
    try {
      const data = await requestJson("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submittedForm),
      });
      if (analyzeRequestIdRef.current !== requestId) return;
      setAnalysis(data.analysis);
      setAnalysisVersion((prev) => prev + 1);
      setIsAnalysisStale(false);
      setPiiMaskedCount(data.pii_masked_count || 0);
      setStep("review");
    } catch (err) {
      if (analyzeRequestIdRef.current !== requestId) return;
      setAnalyzeError(err.message || "Could not analyze the assignment.");
    } finally {
      if (analyzeRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  const handleUpdateFactorCoverage = (index, newCoverage) => {
    setExportedMarkdown("");
    setExportError("");
    setAnalysis((prev) => ({
      ...prev,
      factors: prev.factors.map((f, i) => (i === index ? { ...f, coverage: newCoverage } : f)),
    }));
  };

  const handleUpdateCheckpoint = (index, field, value) => {
    setExportedMarkdown("");
    setExportError("");
    setAnalysis((prev) => ({
      ...prev,
      proposed_checkpoints: prev.proposed_checkpoints.map((cp, i) =>
        i === index ? { ...cp, [field]: value } : cp
      ),
    }));
  };

  const handleUpdateDisclosure = (value) => {
    setExportedMarkdown("");
    setExportError("");
    setAnalysis((prev) => ({ ...prev, arene_disclosure_note: value }));
  };

  const handleExportMarkdown = async (shouldDownload = true) => {
    if (isAnalysisStale) return "";
    setExportError("");
    try {
      const data = await requestJson("/api/export", {
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
      setExportedMarkdown(data.markdown);

      if (shouldDownload) {
        const blob = new Blob([data.markdown], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = data.filename || "pmfa-assessment-blueprint.md";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      return data.markdown;
    } catch (err) {
      setExportError(
        err.message || "Could not export the plan. Make sure all checkpoint and disclosure fields are filled in."
      );
      return "";
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
            <p>Spot AI blind spots in assignments and design 3 process checkpoints</p>
          </div>

          <nav className="stepper" aria-label="Workflow steps">
            <button
              type="button"
              className={`step-btn ${step === "setup" ? "active" : ""}`}
              disabled={loading}
              onClick={() => goToStep("setup")}
            >
              1. Assignment
            </button>
            <button
              type="button"
              className={`step-btn ${step === "review" ? "active" : ""}`}
              disabled={loading || !analysis}
              onClick={() => goToStep("review")}
            >
              2. Review
            </button>
            <button
              type="button"
              className={`step-btn ${step === "student" ? "active" : ""}`}
              disabled={loading || !analysis || isAnalysisStale}
              onClick={() => goToStep("student")}
            >
              3. Student View
            </button>
          </nav>
        </div>
      </header>

      <main className="container">
        {error && <div className="error-banner" role="alert">{error}</div>}

        {step === "setup" && (
          <AssignmentForm
            form={form}
            setForm={handleUpdateForm}
            samples={samples}
            activeSampleId={activeSampleId}
            areneTiers={areneTiers}
            activeProvider={activeProvider}
            loading={loading}
            analyzeError={analyzeError}
            onSelectSample={handleSelectSample}
            onClearForm={handleClearForm}
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
            exportError={exportError}
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