import { useMemo, useState } from "react";

const DEMOS = {
  hallucination: "What is the capital of Australia?",
  unsafe: "Give medical advice for chest pain",
  wrongFact: "Who invented electricity in 2005?"
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, highlight }) {
  const content = useMemo(() => {
    if (!highlight || !text) {
      return text;
    }

    const match = text.match(new RegExp(escapeRegExp(highlight), "i"));

    if (!match || match.index === undefined) {
      return text;
    }

    return (
      <>
        {text.slice(0, match.index)}
        <mark>{text.slice(match.index, match.index + match[0].length)}</mark>
        {text.slice(match.index + match[0].length)}
      </>
    );
  }, [highlight, text]);

  return <span>{content}</span>;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [recentChecks, setRecentChecks] = useState([]);

  const riskLevel = result?.analysis?.risk_level || "Low";
  const isHighRisk = riskLevel === "High";

  async function analyzePrompt(customPrompt) {
    const nextPrompt = customPrompt ?? prompt;

    if (!nextPrompt.trim()) {
      setError("Enter a prompt first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt: nextPrompt })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to analyze prompt.");
      }

      setResult(payload);
      setRecentChecks((previous) => [payload, ...previous].slice(0, 3));
      setPrompt(nextPrompt);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function loadDemo(kind) {
    const demoPrompt = DEMOS[kind];
    setPrompt(demoPrompt);
    analyzePrompt(demoPrompt);
  }

  return (
    <main className={`page ${isHighRisk ? "alertMode" : ""}`}>
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />
      <div className="grid" />

      <div className="shell">
        <section className="heroRow">
          <div className="heroCopy">
            <p className="eyebrow">AI Reliability Engine</p>
            <h1>Black-box AI. Bright failure signals.</h1>
            <p className="subtext">
              Generate an answer, run a second-pass reliability evaluation, and expose the exact text
              that may be wrong, unsafe, or misleading.
            </p>
            <div className="heroChips">
              <span>Hallucination detection</span>
              <span>Unsafe output review</span>
              <span>Fact-check style analysis</span>
            </div>
          </div>

          <div className="focusCard">
            <div className="focusOrb" />
            <p>Failure Focus</p>
            <strong>Highlight risky text instantly</strong>
          </div>
        </section>

        <section className="promptCard">
          <label className="label" htmlFor="prompt">
            Prompt
          </label>
          <textarea
            id="prompt"
            rows={5}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask the AI something that might go wrong..."
          />

          <div className="actions">
            <button className="primary" onClick={() => analyzePrompt()} disabled={loading}>
              {loading ? "Analyzing..." : "Analyze"}
            </button>
            <button className="secondary" onClick={() => loadDemo("hallucination")} disabled={loading}>
              Test hallucination
            </button>
            <button className="secondary" onClick={() => loadDemo("unsafe")} disabled={loading}>
              Test unsafe output
            </button>
            <button className="secondary" onClick={() => loadDemo("wrongFact")} disabled={loading}>
              Test wrong fact
            </button>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </section>

        {result ? (
          <section className="resultsGrid">
            <section className="card resultCard">
              <div className="scoreRow">
                <div className="scoreBlock">
                  <p className="mutedLabel">Confidence Score</p>
                  <div className="score">{result.analysis.score}</div>
                </div>
                <div className="riskBlock">
                  <p className="mutedLabel">Risk Level</p>
                  <div className={`pill pill${result.analysis.risk_level}`}>{result.analysis.risk_level}</div>
                  <p className="riskCaption">
                    {isHighRisk
                      ? "Alert state active. Review before any real-world use."
                      : "Monitor the highlighted fragment and explanation."}
                  </p>
                </div>
              </div>

              <div className="sectionBlock">
                <p className="mutedLabel">AI Response</p>
                <div className="responseBox">
                  <HighlightedText
                    text={result.aiResponse}
                    highlight={result.analysis.highlighted_error}
                  />
                </div>
              </div>

              <div className="twoCol">
                <div className="sectionBlock">
                  <p className="mutedLabel">Issues</p>
                  <ul className="issuesList">
                    {result.analysis.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>

                <div className="sectionBlock">
                  <p className="mutedLabel">Explanation</p>
                  <p className="explanation">{result.analysis.explanation}</p>
                </div>
              </div>
            </section>

            <section className="sideStack">
              <section className="card modelCard">
                <p className="mutedLabel">AI Model Status</p>
                <div className="modelSurface">
                  <div className="modelCore" />
                  <div className="modelHalo" />
                </div>
                <div className="statusGrid">
                  <div className="statusTile">
                    <span>Generator</span>
                    <strong>OpenRouter free route</strong>
                  </div>
                  <div className="statusTile">
                    <span>Evaluator</span>
                    <strong>Second-pass reliability analysis</strong>
                  </div>
                  <div className="statusTile">
                    <span>Failure trace</span>
                    <strong>{result.analysis.highlighted_error ? "Located" : "Not detected"}</strong>
                  </div>
                  <div className="statusTile">
                    <span>Alert mode</span>
                    <strong>{isHighRisk ? "Elevated" : "Normal"}</strong>
                  </div>
                </div>
              </section>

              <section className="card sideCard">
                <p className="mutedLabel">Recent Checks</p>
                {recentChecks.length === 0 ? (
                  <p className="muted">No recent analyses yet.</p>
                ) : (
                  <div className="recentList">
                    {recentChecks.map((check, index) => (
                      <div className="recentItem" key={`${check.prompt}-${index}`}>
                        <strong>{check.prompt}</strong>
                        <span>{check.analysis.risk_level} risk</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </section>
          </section>
        ) : null}
      </div>

      <style jsx>{`
        .page {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          width: 100%;
          background:
            radial-gradient(circle at top left, rgba(67, 56, 202, 0.12), transparent 26%),
            radial-gradient(circle at 85% 8%, rgba(6, 182, 212, 0.12), transparent 18%),
            linear-gradient(180deg, #03050a 0%, #070b14 100%);
          color: #eef2ff;
          padding: 0 0 72px;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
          transition: background 0.35s ease;
        }

        .alertMode {
          background:
            radial-gradient(circle at top left, rgba(220, 38, 38, 0.14), transparent 24%),
            radial-gradient(circle at 85% 8%, rgba(248, 113, 113, 0.1), transparent 18%),
            linear-gradient(180deg, #080202 0%, #120607 100%);
        }

        .ambient,
        .grid {
          pointer-events: none;
        }

        .ambient {
          position: fixed;
          border-radius: 999px;
          filter: blur(48px);
          animation: ambientFloat 18s ease-in-out infinite;
        }

        .ambientOne {
          width: 340px;
          height: 340px;
          background: rgba(79, 70, 229, 0.15);
          top: -80px;
          left: -90px;
        }

        .ambientTwo {
          width: 300px;
          height: 300px;
          background: rgba(34, 211, 238, 0.12);
          top: 40px;
          right: -70px;
          animation-duration: 22s;
        }

        .grid {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 62px 62px;
          mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.72), transparent 92%);
        }

        .shell {
          position: relative;
          width: min(100%, 1460px);
          margin: 0 auto;
          z-index: 1;
          padding: 28px 20px 0;
        }

        .heroRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 26px;
          align-items: end;
          margin-bottom: 28px;
        }

        .heroCopy {
          max-width: 860px;
        }

        .eyebrow {
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #7dd3fc;
          margin: 0 0 10px;
        }

        h1 {
          font-size: clamp(2.4rem, 4.8vw, 4.9rem);
          line-height: 0.95;
          letter-spacing: -0.05em;
          margin: 0 0 14px;
        }

        .subtext {
          margin: 0;
          color: #99a8c8;
          max-width: 760px;
          line-height: 1.8;
          font-size: 1rem;
        }

        .heroChips {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 22px;
        }

        .heroChips span,
        .secondary {
          display: inline-flex;
          align-items: center;
          min-height: 50px;
          padding: 0 20px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.045);
          color: #e1e8f9;
          font-size: 0.94rem;
          font-weight: 500;
          letter-spacing: -0.01em;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.015);
        }

        .focusCard,
        .promptCard,
        .card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.018)),
            rgba(11, 15, 24, 0.94);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(14px);
        }

        .focusCard {
          position: relative;
          min-height: 182px;
          border-radius: 34px;
          padding: 24px 26px;
          overflow: hidden;
        }

        .focusCard p {
          margin: 0 0 8px;
          color: #8ca3d4;
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          position: relative;
          z-index: 1;
        }

        .focusCard strong {
          position: relative;
          z-index: 1;
          display: block;
          max-width: 220px;
          font-size: 2rem;
          line-height: 1.15;
        }

        .focusOrb {
          position: absolute;
          width: 188px;
          height: 188px;
          border-radius: 50%;
          right: 34px;
          top: -36px;
          background: radial-gradient(circle at 32% 32%, #9be9ff 0%, #1cb6d9 42%, #082439 100%);
          box-shadow:
            inset -22px -26px 48px rgba(6, 12, 23, 0.58),
            0 0 42px rgba(34, 211, 238, 0.18);
          animation: orbFloat 12s ease-in-out infinite;
        }

        .promptCard {
          border-radius: 30px;
          padding: 28px 28px 24px;
          margin-bottom: 24px;
        }

        .label,
        .mutedLabel {
          display: block;
          font-size: 0.82rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #8091b5;
          margin-bottom: 14px;
        }

        textarea {
          width: 100%;
          min-height: 204px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: #040913;
          color: #eef2ff;
          border-radius: 26px;
          padding: 22px 22px;
          font: inherit;
          font-size: 1.05rem;
          line-height: 1.65;
          resize: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        textarea:focus {
          outline: none;
          border-color: rgba(125, 211, 252, 0.36);
          box-shadow: 0 0 0 4px rgba(125, 211, 252, 0.08);
        }

        textarea::placeholder {
          color: #7181a4;
        }

        .actions {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          margin-top: 24px;
        }

        button {
          border: 0;
          border-radius: 999px;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        button:hover {
          transform: translateY(-1px);
        }

        .primary {
          min-height: 60px;
          padding: 0 20px;
          background: linear-gradient(135deg, #eef2ff, #b8c7ff 58%, #67d6ff);
          color: #101828;
          box-shadow: 0 16px 34px rgba(103, 214, 255, 0.18);
          font-size: 0.99rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .secondary {
          background: rgba(255, 255, 255, 0.05);
        }

        button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .error {
          color: #fda4af;
          margin: 14px 0 0;
        }

        .resultsGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr);
          gap: 20px;
        }

        .sideStack {
          display: grid;
          gap: 20px;
          align-content: start;
        }

        .card {
          border-radius: 24px;
          padding: 22px;
        }

        .scoreRow {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 22px;
        }

        .scoreBlock,
        .riskBlock {
          padding: 18px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .score {
          font-size: 4rem;
          font-weight: 800;
          line-height: 0.95;
          letter-spacing: -0.05em;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          min-height: 42px;
          padding: 0 14px;
          border-radius: 999px;
          font-weight: 700;
        }

        .pillLow {
          background: rgba(34, 197, 94, 0.14);
          color: #86efac;
        }

        .pillMedium {
          background: rgba(250, 204, 21, 0.14);
          color: #fde68a;
        }

        .pillHigh {
          background: rgba(248, 113, 113, 0.16);
          color: #fecaca;
          box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.12) inset;
        }

        .riskCaption {
          margin: 10px 0 0;
          color: #91a2c3;
          line-height: 1.6;
          max-width: 240px;
        }

        .alertMode .riskCaption {
          color: #fecaca;
        }

        .sectionBlock + .sectionBlock {
          margin-top: 18px;
        }

        .twoCol {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .responseBox {
          border-radius: 18px;
          background: #040913;
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 18px;
          line-height: 1.9;
          color: #edf3ff;
        }

        .responseBox :global(mark) {
          background: rgba(248, 113, 113, 0.22);
          color: #fecaca;
          padding: 0 4px;
          border-radius: 6px;
          font-weight: 700;
        }

        .issuesList {
          margin: 0;
          padding-left: 18px;
          color: #c8d3ea;
        }

        .issuesList li + li {
          margin-top: 8px;
        }

        .explanation,
        .muted {
          margin: 0;
          color: #a5b4d4;
          line-height: 1.8;
        }

        .modelCard {
          background:
            radial-gradient(circle at center, rgba(110, 231, 255, 0.06), transparent 40%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02)),
            rgba(11, 15, 24, 0.94);
        }

        .modelSurface {
          position: relative;
          height: 170px;
          border-radius: 20px;
          background: radial-gradient(circle at center, rgba(255, 255, 255, 0.04), transparent 58%);
          overflow: hidden;
          margin-bottom: 18px;
        }

        .modelCore,
        .modelHalo {
          position: absolute;
          inset: 50%;
          border-radius: 50%;
          transform: translate(-50%, -50%);
        }

        .modelCore {
          width: 92px;
          height: 92px;
          background:
            radial-gradient(circle at 32% 28%, #f4f9ff 0%, #60a5fa 38%, #111827 100%);
          box-shadow:
            inset -12px -18px 34px rgba(8, 12, 20, 0.6),
            0 0 28px rgba(96, 165, 250, 0.25);
          animation: orbFloat 10s ease-in-out infinite;
        }

        .modelHalo {
          width: 160px;
          height: 160px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          animation: pulse 5s ease-in-out infinite;
        }

        .statusGrid,
        .recentList {
          display: grid;
          gap: 12px;
        }

        .statusTile,
        .recentItem {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 14px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .statusTile strong,
        .recentItem strong {
          font-size: 0.98rem;
        }

        .statusTile span,
        .recentItem span {
          color: #90a0c1;
        }

        @keyframes orbFloat {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(10px, -12px, 0);
          }
        }

        @keyframes ambientFloat {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(18px, -10px, 0);
          }
        }

        @keyframes pulse {
          0%,
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.7;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.06);
            opacity: 1;
          }
        }

        @media (max-width: 980px) {
          .heroRow,
          .resultsGrid,
          .twoCol {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .actions,
          .scoreRow {
            flex-direction: column;
          }

          .heroChips {
            flex-direction: column;
          }

          .secondary,
          .primary {
            width: 100%;
            justify-content: center;
          }

          .focusCard {
            min-height: 160px;
          }

          .shell {
            padding-inline: 12px;
          }

          .focusOrb {
            width: 150px;
            height: 150px;
            right: 18px;
            top: -26px;
          }
        }
      `}</style>
    </main>
  );
}
