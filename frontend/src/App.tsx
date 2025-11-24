import React, { useState } from "react";

type ResumeInput = {
  id: string;
  text: string;
};

type AnalyzeResult = {
  id: string;
  verdict: string;
  fitScore: number | null;
  riskScore: number | null;
  report: string;
};

const App: React.FC = () => {
  const [jd, setJd] = useState("");
  const [resumes, setResumes] = useState<ResumeInput[]>([
    { id: "Candidate 1", text: "" },
  ]);
  const [results, setResults] = useState<AnalyzeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const updateResume = (index: number, field: "id" | "text", value: string) => {
    setResumes((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addResume = () => {
    setResumes((prev) => [
      ...prev,
      { id: `Candidate ${prev.length + 1}`, text: "" },
    ]);
  };

  const removeResume = (index: number) => {
    setResumes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    setError(null);
    setResults([]);
    setExpandedId(null);

    if (!jd.trim()) {
      setError("Paste the job description first.");
      return;
    }

    const nonEmptyResumes = resumes.filter((r) => r.text.trim().length > 0);
    if (nonEmptyResumes.length === 0) {
      setError("Provide at least one resume.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jd,
          resumes: nonEmptyResumes,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed with ${res.status}`);
      }

      const data = (await res.json()) as { results: AnalyzeResult[] };
      setResults(data.results);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const scoreBadgeClass = (score: number | null, type: "fit" | "risk") => {
    if (score === null) return "bg-slate-700 text-slate-200";
    if (type === "fit") {
      if (score >= 8) return "bg-emerald-600/90 text-emerald-50";
      if (score >= 5) return "bg-amber-500/90 text-amber-50";
      return "bg-red-500/90 text-red-50";
    } else {
      // risk score – inverse
      if (score <= 3) return "bg-emerald-600/90 text-emerald-50";
      if (score <= 6) return "bg-amber-500/90 text-amber-50";
      return "bg-red-500/90 text-red-50";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center px-4 py-10">
      <div className="w-full max-w-6xl space-y-8">
        
        <header className="flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              FitScore AI
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Paste one job description, paste multiple resumes, and get a
              ruthless founder-style <span className="font-semibold">FitScore</span>{" "}
              & <span className="font-semibold">RiskScore</span> for each
              candidate.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/60 border border-slate-700 px-4 py-2 text-xs text-slate-300">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 mr-1" />
            Powered by Zypher + Claude 3 Haiku
          </div>
        </header>

        {/* JD + Resumes */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* JD card */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/40">
            <h2 className="text-sm font-semibold text-slate-100 mb-2">
              Job Description
            </h2>
            <p className="text-xs text-slate-400 mb-3">
              Paste the CoreSpeed Senior Full-Stack / Agent Infra JD here, or
              any other role you want to test.
            </p>
            <textarea
              className="w-full h-60 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
              placeholder="Paste the JD here..."
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />
          </section>

          {/* Resumes */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/40 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Candidate Resumes
                </h2>
                <p className="text-xs text-slate-400">
                  Each block is a full resume. Compare multiple candidates
                  against the same JD.
                </p>
              </div>
              <button
                onClick={addResume}
                className="text-xs px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 transition-colors"
              >
                + Add Resume
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1">
              {resumes.map((r, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Candidate name or label"
                      value={r.id}
                      onChange={(e) => updateResume(index, "id", e.target.value)}
                    />
                    {resumes.length > 1 && (
                      <button
                        onClick={() => removeResume(index)}
                        className="text-[10px] uppercase tracking-wide text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <textarea
                    className="w-full h-28 rounded-lg bg-slate-950 border border-slate-800 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    placeholder="Paste the full resume text here..."
                    value={r.text}
                    onChange={(e) => updateResume(index, "text", e.target.value)}
                  />
                </div>
              ))}
            </div>

            {/* Error + Analyze button */}
            <div className="mt-4 space-y-2">
              {error && (
                <div className="text-xs text-red-300 bg-red-950/50 border border-red-700/70 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="w-full justify-center inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-semibold transition-colors"
              >
                {loading ? (
                  <>
                    <span className="h-3 w-3 border-2 border-emerald-200 border-t-transparent rounded-full animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  "Analyze Resumes"
                )}
              </button>
            </div>
          </section>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/40">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Results
                </h2>
                <p className="text-xs text-slate-400">
                  FitScore = how well they match. RiskScore = how likely this
                  resume is overselling / risky for CoreSpeed.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-900/90">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold border-b border-slate-800">
                      Candidate
                    </th>
                    <th className="px-3 py-2 text-left font-semibold border-b border-slate-800">
                      FitScore
                    </th>
                    <th className="px-3 py-2 text-left font-semibold border-b border-slate-800">
                      RiskScore
                    </th>
                    <th className="px-3 py-2 text-left font-semibold border-b border-slate-800">
                      Verdict
                    </th>
                    <th className="px-3 py-2 text-left font-semibold border-b border-slate-800">
                      Report
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, idx) => (
                    <tr
                      key={r.id}
                      className={
                        idx % 2 === 0
                          ? "bg-slate-950/60"
                          : "bg-slate-900/60"
                      }
                    >
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        {r.id}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${scoreBadgeClass(
                            r.fitScore,
                            "fit",
                          )}`}
                        >
                          {r.fitScore ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${scoreBadgeClass(
                            r.riskScore,
                            "risk",
                          )}`}
                        >
                          {r.riskScore ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top max-w-xl">
                        <span className="line-clamp-2 text-slate-200">
                          {r.verdict || "No verdict parsed"}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        <button
                          onClick={() =>
                            setExpandedId(
                              expandedId === r.id ? null : r.id,
                            )
                          }
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 hover:underline"
                        >
                          {expandedId === r.id
                            ? "Hide full report"
                            : "View full report"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {results.map(
              (r) =>
                expandedId === r.id && (
                  <div
                    key={r.id}
                    className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-4"
                  >
                    <h3 className="text-sm font-semibold mb-2">
                      Full Report — {r.id}
                    </h3>
                    <pre className="whitespace-pre-wrap text-xs text-slate-200 leading-relaxed">
                      {r.report}
                    </pre>
                  </div>
                ),
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default App;
