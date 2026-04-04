import Head from "next/head";
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
    <>
      <Head>
        <title>STABLE - AI Reliability Engine</title>
        <meta
          name="description"
          content="Detect when your AI gives wrong or risky answers with STABLE AI Reliability Engine."
        />
      </Head>

      <main className={`page ${isHighRisk ? "alertMode" : ""}`}>
        <div className="backgroundGlow glowLeft" />
        <div className="backgroundGlow glowRight" />
        <div className="grid" />

        <div className="shell">
          <header className="topBar">
            <div className="brandLockup">
              <div className="brandBadge">
                <img src="/brand/stable-logo.png" alt="STABLE logo" className="brandLogo" />
              </div>
              <div>
                <p className="eyebrow">STABLE - AI Reliability Engine</p>
                <p className="brandCaption">Production-grade failure detection for risky AI outputs</p>
              </div>
            </div>

            <div className="statusStrip">
              <span className="statusDot" />
              OpenRouter connected analysis flow
            </div>
          </header>

          <section className="heroRow">
            <div className="heroCopy">
              <h1>Detect when your AI gives wrong or risky answers</h1>
              <p className="subtext">
                Generate an answer, run a second-pass evaluator, and surface the exact phrase that may be
                unreliable, unsafe, or factually weak before it reaches real users.
              </p>

              <div className="heroChips">
                <span>Response verification</span>
                <span>Hallucination review</span>
                <span>Risk classification</span>
              </div>

              <div className="metricRow">
                <div className="metricCard">
                  <span>Detection focus</span>
                  <strong>Wrong facts, unsafe advice, hidden failure patterns</strong>
                </div>
                <div className="metricCard">
                  <span>Output style</span>
                  <strong>Clear highlights, confidence score, investor-ready reliability signal</strong>
                </div>
              </div>
            </div>

            <div className="visualCard">
              <div className="visualTop">
                <span className="visualLabel">Reliability signal</span>
                <span className="visualMini">Live trace</span>
              </div>

              <div className="visualStage">
                <div className="haloRing ringOne" />
                <div className="haloRing ringTwo" />
                <div className="coreSphere" />
                <div className="signalBeam" />
              </div>

              <div className="visualFooter">
                <div>
                  <p>Failure focus</p>
                  <strong>Highlight risky text instantly</strong>
                </div>
                <img src="/brand/stable-logo.png" alt="STABLE wordmark" className="miniLogo" />
              </div>
            </div>
          </section>

          <section className="promptCard">
            <label className="label" htmlFor="prompt">
              Prompt
            </label>
            <textarea
              id="prompt"
              rows={6}
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
                    <p className="scoreNote">Confidence in answer reliability after secondary evaluation</p>
                  </div>

                  <div className="riskBlock">
                    <p className="mutedLabel">Risk Level</p>
                    <div className={`pill pill${result.analysis.risk_level}`}>{result.analysis.risk_level}</div>
                    <p className="riskCaption">
                      {isHighRisk
                        ? "High-risk answer detected. Review the marked phrase before using this output."
                        : "The evaluator found manageable risk. Inspect the marked fragment and issues below."}
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
                  <p className="mutedLabel">Analysis Pipeline</p>
                  <div className="statusGrid">
                    <div className="statusTile">
                      <span>Provider</span>
                      <strong>OpenRouter</strong>
                    </div>
                    <div className="statusTile">
                      <span>Generation pass</span>
                      <strong>Model answer created from your prompt</strong>
                    </div>
                    <div className="statusTile">
                      <span>Evaluation pass</span>
                      <strong>Structured reliability review with highlighted failure text</strong>
                    </div>
                    <div className="statusTile">
                      <span>Current state</span>
                      <strong>{isHighRisk ? "Alert raised" : "System stable"}</strong>
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

        <style jsx global>{`
          * {
            box-sizing: border-box;
          }

          html,
          body,
          #__next {
            margin: 0;
            padding: 0;
            min-height: 100%;
            height: 100%;
            width: 100%;
            min-width: 100vw;
            background: #050505 !important;
          }

          body {
            overflow-x: hidden;
            background: #050505 !important;
          }

          #__next {
            display: block;
            background: #050505 !important;
          }
        `}</style>

        <style jsx>{`
          .page {
            position: relative;
            min-height: 100vh;
            overflow: hidden;
            width: 100%;
            min-width: 100vw;
            background:
              radial-gradient(circle at 12% 10%, rgba(255, 96, 61, 0.16), transparent 22%),
              radial-gradient(circle at 82% 8%, rgba(255, 138, 76, 0.12), transparent 20%),
              linear-gradient(180deg, #050505 0%, #0a0707 38%, #0c0808 100%);
            color: #fff7f2;
            padding: 0 0 72px;
            font-family:
              Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
              sans-serif;
            transition: background 0.35s ease;
          }

          .alertMode {
            background:
              radial-gradient(circle at 12% 10%, rgba(255, 74, 43, 0.22), transparent 24%),
              radial-gradient(circle at 82% 8%, rgba(255, 132, 79, 0.16), transparent 22%),
              linear-gradient(180deg, #080303 0%, #140707 40%, #120505 100%);
          }

          .backgroundGlow,
          .grid {
            pointer-events: none;
          }

          .backgroundGlow {
            position: fixed;
            border-radius: 999px;
            filter: blur(64px);
            opacity: 0.9;
            animation: ambientFloat 22s ease-in-out infinite;
          }

          .glowLeft {
            width: 380px;
            height: 380px;
            background: rgba(255, 89, 50, 0.18);
            top: -100px;
            left: -100px;
          }

          .glowRight {
            width: 340px;
            height: 340px;
            background: rgba(255, 157, 93, 0.14);
            top: 10px;
            right: -90px;
            animation-duration: 26s;
          }

          .grid {
            position: fixed;
            inset: 0;
            background-image:
              linear-gradient(rgba(255, 255, 255, 0.028) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.028) 1px, transparent 1px);
            background-size: 60px 60px;
            mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.74), transparent 94%);
          }

          .shell {
            position: relative;
            width: min(100%, 1440px);
            margin: 0 auto;
            z-index: 1;
            padding: 22px 20px 0;
          }

          .topBar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 28px;
          }

          .brandLockup {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .brandBadge {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 180px;
            height: 68px;
            border-radius: 22px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.03);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
          }

          .brandLogo {
            width: 128px;
            height: auto;
            display: block;
            filter: drop-shadow(0 10px 22px rgba(255, 92, 58, 0.22));
          }

          .eyebrow {
            margin: 0 0 5px;
            font-size: 0.78rem;
            font-weight: 800;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: #ff9d74;
          }

          .brandCaption {
            margin: 0;
            color: #bcaaa2;
            font-size: 0.96rem;
          }

          .statusStrip {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            min-height: 48px;
            padding: 0 18px;
            border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.045);
            color: #f6d1c3;
            font-size: 0.92rem;
            white-space: nowrap;
          }

          .statusDot {
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: #ff6e45;
            box-shadow: 0 0 0 6px rgba(255, 110, 69, 0.14);
          }

          .heroRow {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 430px;
            gap: 28px;
            align-items: stretch;
            min-height: calc(100vh - 300px);
            margin-bottom: 18px;
          }

          .heroCopy {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            max-width: 860px;
            padding-bottom: 10px;
          }

          h1 {
            margin: 0 0 16px;
            max-width: 10.5ch;
            font-size: clamp(2.5rem, 5vw, 5.4rem);
            line-height: 0.95;
            letter-spacing: -0.07em;
            color: #fff4ef;
          }

          .subtext {
            margin: 0;
            max-width: 760px;
            color: #c6b0a6;
            line-height: 1.8;
            font-size: 1.03rem;
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
            background: rgba(255, 255, 255, 0.04);
            color: #f8ddd1;
            font-size: 0.94rem;
            font-weight: 550;
            letter-spacing: -0.01em;
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
          }

          .metricRow {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            margin-top: 22px;
          }

          .metricCard,
          .visualCard,
          .promptCard,
          .card {
            border: 1px solid rgba(255, 255, 255, 0.08);
            background:
              linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.015)),
              rgba(15, 10, 10, 0.95);
            box-shadow: 0 28px 70px rgba(0, 0, 0, 0.34);
            backdrop-filter: blur(14px);
          }

          .metricCard {
            padding: 18px 18px 20px;
            border-radius: 22px;
          }

          .metricCard span {
            display: block;
            margin-bottom: 10px;
            color: #ffae90;
            font-size: 0.8rem;
            font-weight: 800;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .metricCard strong {
            display: block;
            color: #fff0ea;
            line-height: 1.45;
            font-size: 1rem;
          }

          .visualCard {
            border-radius: 34px;
            padding: 22px;
            display: flex;
            flex-direction: column;
            min-height: 100%;
          }

          .visualTop,
          .visualFooter {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
          }

          .visualLabel,
          .visualMini,
          .visualFooter p {
            color: #ffb394;
            font-size: 0.78rem;
            font-weight: 800;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            margin: 0;
          }

          .visualMini {
            color: #c8a99f;
          }

          .visualStage {
            position: relative;
            height: 310px;
            margin: 18px 0 14px;
            border-radius: 30px;
            background:
              radial-gradient(circle at 50% 40%, rgba(255, 122, 79, 0.1), transparent 36%),
              linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.01));
            border: 1px solid rgba(255, 255, 255, 0.05);
            overflow: hidden;
          }

          .coreSphere,
          .haloRing,
          .signalBeam {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
          }

          .coreSphere {
            top: 66px;
            width: 176px;
            height: 176px;
            border-radius: 50%;
            background:
              radial-gradient(circle at 34% 28%, #ffd7c7 0%, #ff8f61 26%, #ff5e3b 55%, #49150f 100%);
            box-shadow:
              inset -24px -30px 52px rgba(40, 8, 6, 0.62),
              0 28px 58px rgba(255, 94, 59, 0.18),
              0 0 0 1px rgba(255, 255, 255, 0.05);
            animation: orbFloat 12s ease-in-out infinite;
          }

          .haloRing {
            border-radius: 50%;
            border: 1px solid rgba(255, 171, 134, 0.18);
          }

          .ringOne {
            top: 42px;
            width: 226px;
            height: 226px;
            animation: pulse 6s ease-in-out infinite;
          }

          .ringTwo {
            top: 24px;
            width: 272px;
            height: 272px;
            border-color: rgba(255, 217, 193, 0.08);
            animation: pulse 8s ease-in-out infinite;
          }

          .signalBeam {
            bottom: -24px;
            width: 2px;
            height: 158px;
            background: linear-gradient(180deg, rgba(255, 176, 138, 0.9), rgba(255, 94, 59, 0));
            box-shadow: 0 0 18px rgba(255, 120, 78, 0.24);
          }

          .visualFooter {
            margin-top: auto;
            align-items: flex-end;
          }

          .visualFooter strong {
            display: block;
            margin-top: 8px;
            max-width: 220px;
            font-size: 1.5rem;
            line-height: 1.15;
            color: #fff0e8;
          }

          .miniLogo {
            width: 118px;
            height: auto;
            opacity: 0.92;
            filter: drop-shadow(0 10px 24px rgba(255, 92, 58, 0.18));
          }

          .promptCard {
            border-radius: 30px;
            padding: 24px 28px 22px;
            margin-bottom: 18px;
          }

          .label,
          .mutedLabel {
            display: block;
            margin-bottom: 14px;
            font-size: 0.8rem;
            font-weight: 800;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: #ffad8c;
          }

          textarea {
            width: 100%;
            min-height: 210px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: #070707;
            color: #fff5f0;
            border-radius: 28px;
            padding: 22px;
            font: inherit;
            font-size: 1.05rem;
            line-height: 1.7;
            resize: none;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
          }

          textarea:focus {
            outline: none;
            border-color: rgba(255, 153, 112, 0.42);
            box-shadow: 0 0 0 4px rgba(255, 122, 79, 0.1);
          }

          textarea::placeholder {
            color: #8b6e66;
          }

          .actions {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            margin-top: 20px;
          }

          button {
            border: 0;
            border-radius: 999px;
            font: inherit;
            font-weight: 700;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
          }

          button:hover {
            transform: translateY(-1px);
          }

          button:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }

          .primary {
            min-height: 60px;
            padding: 0 22px;
            background: linear-gradient(135deg, #ffd4bf, #ff9668 42%, #ff5c3a 100%);
            color: #2d0f09;
            box-shadow: 0 18px 34px rgba(255, 94, 59, 0.24);
            font-size: 1rem;
          }

          .secondary {
            background: rgba(255, 255, 255, 0.05);
          }

          .error {
            color: #ffb5a1;
            margin: 14px 0 0;
          }

          .resultsGrid {
            display: grid;
            grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
            gap: 20px;
            align-items: start;
          }

          .sideStack {
            display: grid;
            gap: 16px;
            align-content: start;
          }

          .card {
            border-radius: 24px;
            padding: 22px;
          }

          .scoreRow {
            display: flex;
            justify-content: space-between;
            align-items: stretch;
            gap: 16px;
            margin-bottom: 18px;
          }

          .scoreBlock,
          .riskBlock {
            flex: 1;
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
            color: #fff4ef;
          }

          .scoreNote,
          .riskCaption {
            margin: 10px 0 0;
            color: #bfaaa0;
            line-height: 1.65;
          }

          .alertMode .riskCaption {
            color: #ffd1c3;
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
            background: rgba(249, 115, 22, 0.14);
            color: #fdba74;
          }

          .pillMedium {
            background: rgba(251, 191, 36, 0.12);
            color: #fde68a;
          }

          .pillHigh {
            background: rgba(248, 113, 113, 0.16);
            color: #fecaca;
            box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.12) inset;
          }

          .sectionBlock + .sectionBlock {
            margin-top: 14px;
          }

          .twoCol {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
          }

          .responseBox {
            border-radius: 20px;
            background: #070707;
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 18px;
            line-height: 1.9;
            color: #fff3ed;
          }

          .responseBox :global(mark) {
            background: rgba(255, 94, 59, 0.2);
            color: #ffd2c4;
            padding: 0 4px;
            border-radius: 6px;
            font-weight: 700;
            box-shadow: inset 0 0 0 1px rgba(255, 134, 101, 0.15);
          }

          .issuesList {
            margin: 0;
            padding-left: 18px;
            color: #f0d5ca;
          }

          .issuesList li + li {
            margin-top: 8px;
          }

          .explanation,
          .muted {
            margin: 0;
            color: #c1aba2;
            line-height: 1.8;
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
            color: #fff1eb;
          }

          .statusTile span,
          .recentItem span {
            color: #c09f92;
          }

          @keyframes orbFloat {
            0%,
            100% {
              transform: translateX(-50%) translate3d(0, 0, 0);
            }
            50% {
              transform: translateX(-50%) translate3d(0, -10px, 0);
            }
          }

          @keyframes ambientFloat {
            0%,
            100% {
              transform: translate3d(0, 0, 0);
            }
            50% {
              transform: translate3d(16px, -12px, 0);
            }
          }

          @keyframes pulse {
            0%,
            100% {
              transform: translateX(-50%) scale(1);
              opacity: 0.72;
            }
            50% {
              transform: translateX(-50%) scale(1.05);
              opacity: 1;
            }
          }

          @media (max-width: 1100px) {
            .heroRow,
            .resultsGrid,
            .twoCol,
            .metricRow {
              grid-template-columns: 1fr;
            }

            .heroRow {
              min-height: auto;
            }
          }

          @media (max-width: 760px) {
            .topBar,
            .scoreRow,
            .actions {
              flex-direction: column;
              align-items: stretch;
            }

            .brandLockup {
              align-items: flex-start;
            }

            .statusStrip,
            .secondary,
            .primary {
              width: 100%;
              justify-content: center;
            }

            .heroChips {
              flex-direction: column;
            }

            .visualCard {
              padding: 18px;
            }

            .visualStage {
              height: 270px;
            }

            .coreSphere {
              width: 150px;
              height: 150px;
              top: 62px;
            }

            .ringOne {
              width: 206px;
              height: 206px;
            }

            .ringTwo {
              width: 246px;
              height: 246px;
            }

            .shell {
              padding-inline: 12px;
            }

            h1 {
              font-size: clamp(2.25rem, 13vw, 3.7rem);
            }
          }
        `}</style>
      </main>
    </>
  );
}
