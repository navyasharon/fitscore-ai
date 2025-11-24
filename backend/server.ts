// server.ts – FitScore AI backend using Zypher + Claude 3 Haiku
// Uses a simple tagged text format instead of JSON to avoid parsing issues.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import "jsr:@std/dotenv/load";

import {
  AnthropicModelProvider,
  createZypherContext,
  ZypherAgent,
} from "@corespeed/zypher";

import { eachValueFrom } from "npm:rxjs-for-await";

// TODO: optimize this later


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

// --- helpers ---

function getRequiredEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return v;
}

const MODEL_NAME = "claude-3-haiku-20240307";

// Initialize Zypher agent once at startup
// TODO: optimize this later

const zypherContext = await createZypherContext(Deno.cwd());
const provider = new AnthropicModelProvider({
  apiKey: getRequiredEnv("ANTHROPIC_API_KEY"),
});

const agent = new ZypherAgent(zypherContext, provider, {
  config: {
    maxTokens: 1024,
    maxIterations: 6,
    taskTimeoutMs: 120_000,
  },
});

// Run one Zypher task and return the final accumulated text
async function runZypherTask(prompt: string): Promise<string> {
  const event$ = agent.runTask(prompt, MODEL_NAME);
  let finalText = "";

  for await (const event of eachValueFrom(event$)) {
    if (event.type === "text-delta" && (event as any).delta) {
      finalText += (event as any).delta as string;
    } else if (event.type === "text" && (event as any).content) {
      finalText += (event as any).content as string;
    }
  }

  return finalText.trim();
}

// Build the per-candidate prompt
function buildPrompt(jd: string, resumeText: string): string {
  return `
You are a ruthless startup founder reviewing candidates for a Senior Full-Stack / Agent Infra role at CoreSpeed.

You get:
1) The exact job description (JD).
2) One candidate’s resume.

Your job:
- Decide how well this candidate truly fits the JD.
- Detect any bullshit / AI-rewritten / keyword-stuffed patterns.
- Score both Fit and Risk.

IMPORTANT: You MUST respond in the following EXACT plain-text format.
Do NOT add any extra explanation, headings, markdown, or text before FIT_SCORE:.

FIT_SCORE: <integer 0-10>
RISK_SCORE: <integer 0-10>
VERDICT: <short one-sentence founder-style verdict>
REPORT:
<multi-line markdown analysis; sections: Alignment, Gaps, Red Flags, Verdict>

Rules:
- fitScore: higher = better match to JD (skills, stack, scope, ownership).
- riskScore: higher = more risky (inflated buzzwords, weak ownership, shallow infra experience).
- Be brutally honest but grounded in the evidence from the resume vs JD.
- If information is missing, say so instead of hallucinating.

---------------- JD START ----------------
${jd}
---------------- JD END ------------------

------------- RESUME START --------------
${resumeText}
------------- RESUME END ----------------
`;
}

// Parse the model's tagged text output into our structured shape
function parseModelOutput(raw: string): {
  fitScore: number | null;
  riskScore: number | null;
  verdict: string;
  report: string;
} {
  const fitMatch = raw.match(/FIT_SCORE\s*:\s*(\d+)/i);
  const riskMatch = raw.match(/RISK_SCORE\s*:\s*(\d+)/i);
  const verdictMatch = raw.match(/VERDICT\s*:\s*(.+)/i);
  const reportIndex = raw.search(/REPORT\s*:/i);

  const fitScore = fitMatch ? Number(fitMatch[1]) : null;
  const riskScore = riskMatch ? Number(riskMatch[1]) : null;
  const verdict = verdictMatch
    ? verdictMatch[1].trim()
    : "No clear verdict parsed";

  let report = raw;
  if (reportIndex !== -1) {
    // everything after "REPORT:" line
    const after = raw.slice(reportIndex);
    const firstNewline = after.indexOf("\n");
    report =
      firstNewline !== -1 ? after.slice(firstNewline + 1).trim() : after.trim();
  }

  return { fitScore, riskScore, verdict, report };
}

// --- HTTP server ---

console.log("🟢 FitScore AI backend starting… (Zypher + Claude 3 Haiku)");

serve(
  async (req) => {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
    // TODO: optimize this later


    if (url.pathname === "/analyze" && req.method === "POST") {
      try {
        const body = (await req.json()) as {
          jd?: string;
          resumes?: ResumeInput[];
        };

        const jd = body.jd?.trim() ?? "";
        const resumes = body.resumes ?? [];

        if (!jd) {
          return json(
            { error: "Missing 'jd' in request body" },
            400,
          );
        }
        if (resumes.length === 0) {
          return json(
            { error: "Provide at least one resume" },
            400,
          );
        }

        const results: AnalyzeResult[] = [];

        for (const r of resumes) {
          if (!r.text || !r.text.trim()) continue;

          const prompt = buildPrompt(jd, r.text);
          let fitScore: number | null = null;
          let riskScore: number | null = null;
          let verdict = "";
          let report = "";

          try {
            const raw = await runZypherTask(prompt);
            console.log(`📄 Raw model output for ${r.id}:\n${raw}\n---`);
            const parsed = parseModelOutput(raw);

            fitScore = parsed.fitScore;
            riskScore = parsed.riskScore;
            verdict = parsed.verdict;
            report = parsed.report;
          } catch (err) {
            console.error(`❌ Error analyzing resume "${r.id}":`, err);
            verdict =
              "Analysis failed — fallback verdict. Check backend logs.";
            report = `Raw error: ${
              err instanceof Error ? err.message : String(err)
            }`;
          }

          results.push({
            id: r.id,
            fitScore,
            riskScore,
            verdict,
            report,
          });
        }

        return json({ results });
      } catch (err) {
        console.error("❌ /analyze handler error:", err);
        return json(
          {
            error:
              "Internal server error while analyzing resumes. Check backend logs.",
          },
          500,
        );
      }
    }
   // if (!fitScore) fitScore = 0; // safe fallback


    // default 404
    return new Response("Not found", {
      status: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
  {
    // Deno std's `serve` will log the actual port;
    // your frontend is already calling http://localhost:8000/analyze
    addr: ":8000",
  },
);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
