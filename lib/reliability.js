import OpenAI from "openai";

const minWordCount = 3;
const passConsistencyThreshold = 68;
const inconsistentThreshold = 55;
const mockDelayMs = 350;
const runCount = 3;
const severityWeights = {
  Pass: 0,
  Inconsistent: 0.45,
  LowReasoning: 0.55,
  IncorrectFact: 0.75,
  Hallucination: 0.9
};

function normalizeText(value = "") {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function getWordCount(value = "") {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function jaccardSimilarity(first = "", second = "") {
  const a = new Set(normalizeText(first).split(" ").filter(Boolean));
  const b = new Set(normalizeText(second).split(" ").filter(Boolean));

  if (a.size === 0 && b.size === 0) {
    return 1;
  }

  const intersection = [...a].filter((word) => b.has(word)).length;
  const union = new Set([...a, ...b]).size;

  return union === 0 ? 0 : intersection / union;
}

function calculateConsistency(outputs = []) {
  const pairwise = [];

  for (let index = 0; index < outputs.length; index += 1) {
    for (let next = index + 1; next < outputs.length; next += 1) {
      pairwise.push(jaccardSimilarity(outputs[index], outputs[next]));
    }
  }

  if (pairwise.length === 0) {
    return 100;
  }

  const average = pairwise.reduce((sum, score) => sum + score, 0) / pairwise.length;
  return Math.round(average * 100);
}

function getMissingKeywords(outputs, expectedKeywords = "") {
  const keywords = expectedKeywords
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  const missingKeywords = keywords.filter(
    (keyword) => outputs.some((output) => !normalizeText(output).includes(normalizeText(keyword)))
  );

  return [...new Set(missingKeywords)];
}

function getBaselineAssessment(outputs, expectedKeywords = "") {
  const missingKeywords = getMissingKeywords(outputs, expectedKeywords);
  const tooShort = outputs.some((output) => getWordCount(output) < minWordCount);
  const consistencyScore = calculateConsistency(outputs);

  if (tooShort) {
    return {
      status: "Fail",
      failureType: "Low reasoning",
      failureKey: "LowReasoning",
      reason: "Response was too short to be reliable.",
      explanation: "At least one run was so brief that it did not show enough reasoning or supporting detail.",
      severity: severityWeights.LowReasoning,
      consistencyScore,
      missingKeywords
    };
  }

  if (missingKeywords.length > 0) {
    return {
      status: "Fail",
      failureType: "Incorrect fact",
      failureKey: "IncorrectFact",
      reason: `Expected keyword(s) missing: ${missingKeywords.join(", ")}.`,
      explanation: "The answer missed required factual anchors, which makes the response unreliable for this check.",
      severity: severityWeights.IncorrectFact,
      consistencyScore,
      missingKeywords
    };
  }

  if (consistencyScore < inconsistentThreshold) {
    return {
      status: "Inconsistent",
      failureType: "Inconsistent",
      failureKey: "Inconsistent",
      reason: "Runs disagreed materially with each other.",
      explanation: "The model changed its answer across repeated runs, which signals unstable behavior.",
      severity: severityWeights.Inconsistent,
      consistencyScore,
      missingKeywords
    };
  }

  if (consistencyScore < passConsistencyThreshold) {
    return {
      status: "Inconsistent",
      failureType: "Inconsistent",
      failureKey: "Inconsistent",
      reason: "Slight but meaningful variation detected across runs.",
      explanation: "The outputs were directionally similar but varied enough to reduce trust in repeatability.",
      severity: severityWeights.Inconsistent,
      consistencyScore,
      missingKeywords
    };
  }

  return {
    status: "Pass",
    failureType: "Validated",
    failureKey: "Pass",
    reason: "Answer passed factual and consistency checks.",
    explanation: "The answer stayed stable across runs and included the expected keywords.",
    severity: severityWeights.Pass,
    consistencyScore,
    missingKeywords
  };
}

function buildMockResponse(mainPrompt, question, expectedKeywords, runNumber) {
  const normalizedQuestion = normalizeText(question);
  const firstKeyword = expectedKeywords
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean)[0] || "";

  if (normalizedQuestion.includes("capital of france")) {
    return [
      "The capital of France is Paris.",
      "The capital of France is Paris, in Europe.",
      "The capital of France is Paris."
    ][runNumber - 1];
  }

  if (normalizedQuestion.includes("2+2") || normalizedQuestion.includes("solve 2+2")) {
    return [
      "2 + 2 equals 4.",
      "2 + 2 equals 4, so the answer is 4.",
      "2 + 2 equals 4."
    ][runNumber - 1];
  }

  if (normalizedQuestion.includes("color of the sky")) {
    return [
      "A common color of the sky is blue.",
      "A common color of the sky is blue during a clear day.",
      "A common color of the sky is blue."
    ][runNumber - 1];
  }

  if (normalizedQuestion.includes("president of mars")) {
    return [
      "The president of Mars is Elon Musk.",
      "Mars does not have a real president, but Elon Musk is often joked about.",
      "There is no official president of Mars."
    ][runNumber - 1];
  }

  if (normalizedQuestion.includes("one word") || normalizedQuestion.includes("brief")) {
    return ["Okay.", "Sure.", "Yes."][runNumber - 1];
  }

  const styleSnippet = mainPrompt ? `Following the prompt \"${mainPrompt}\", ` : "";
  const keywordSnippet = firstKeyword ? ` It references ${firstKeyword}.` : "";

  return `${styleSnippet}this mock run answers \"${question}\" in a plausible way.${keywordSnippet}`.trim();
}

async function generateMockRuns(mainPrompt, question, expectedKeywords) {
  await new Promise((resolve) => setTimeout(resolve, mockDelayMs));

  return Array.from({ length: runCount }, (_, index) =>
    buildMockResponse(mainPrompt, question, expectedKeywords, index + 1)
  );
}

async function generateResponse(client, model, mainPrompt, question) {
  const completion = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: mainPrompt }]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: question }]
      }
    ]
  });

  return completion.output_text?.trim() || "";
}

function parseAnalyzerJson(text = "") {
  const trimmed = text.trim();
  const match = trimmed.match(/\{[\s\S]*\}/);

  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function analyzeFailureWithModel(client, model, payload) {
  const analysisPrompt = [
    "Analyze the AI outputs for reliability failure.",
    "Return strict JSON with keys: classification, reason, explanation, severity.",
    'classification must be one of: "Hallucination", "Incorrect fact", "Inconsistent", "Low reasoning".',
    'severity must be one of: "high", "medium", "low".',
    "Keep reason under 12 words.",
    "Keep explanation to 1-2 sentences.",
    `Question: ${payload.question}`,
    `Expected Keywords: ${payload.expectedKeywords || "None"}`,
    `Preliminary Status: ${payload.status}`,
    `Preliminary Reason: ${payload.reason}`,
    `Consistency Score: ${payload.consistencyScore}%`,
    `Run 1: ${payload.outputs[0] || ""}`,
    `Run 2: ${payload.outputs[1] || ""}`,
    `Run 3: ${payload.outputs[2] || ""}`
  ].join("\n");

  const completion = await client.responses.create({
    model,
    input: analysisPrompt
  });

  return parseAnalyzerJson(completion.output_text || "");
}

function buildFallbackFailureAnalysis(result) {
  if (result.failureKey === "LowReasoning") {
    return {
      classification: "Low reasoning",
      reason: "Response lacked enough substance.",
      explanation: "One or more runs were too short to show useful reasoning or confidence.",
      severity: "medium"
    };
  }

  if (result.failureKey === "IncorrectFact") {
    const hallucinationSignal = normalizeText(result.question).includes("mars") ||
      result.outputs.some((output) => normalizeText(output).includes("elon musk"));

    return hallucinationSignal
      ? {
          classification: "Hallucination",
          reason: "Model invented a non-existent entity.",
          explanation: "The answer introduced an entity or role that does not exist in the real world, which is a classic hallucination pattern.",
          severity: "high"
        }
      : {
          classification: "Incorrect fact",
          reason: "Required factual anchor was missing.",
          explanation: "The answer failed a keyword-backed fact check, so it cannot be trusted for this test case.",
          severity: "high"
        };
  }

  return {
    classification: "Inconsistent",
    reason: "Repeated runs diverged too much.",
    explanation: "The model produced meaningfully different outputs across repeated runs, which indicates unstable behavior.",
    severity: "medium"
  };
}

function severityFromLabel(label = "low") {
  if (label === "high") {
    return 0.9;
  }

  if (label === "medium") {
    return 0.6;
  }

  return 0.35;
}

async function buildFailureAnalysis(client, model, result, mode) {
  if (result.status === "Pass") {
    return {
      failureReason: "Validated",
      failureExplanation: "The answer remained stable across repeated runs and passed the expected-keyword checks.",
      failureSeverity: 0,
      showcase: false
    };
  }

  if (mode === "live") {
    const analyzed = await analyzeFailureWithModel(client, model, result);

    if (analyzed?.classification) {
      return {
        failureReason: analyzed.classification,
        failureExplanation: analyzed.explanation || result.explanation,
        failureSeverity: severityFromLabel(analyzed.severity),
        showcase: true,
        shortReason: analyzed.reason || result.reason
      };
    }
  }

  const fallback = buildFallbackFailureAnalysis(result);

  return {
    failureReason: fallback.classification,
    failureExplanation: fallback.explanation,
    failureSeverity: severityFromLabel(fallback.severity),
    showcase: true,
    shortReason: fallback.reason
  };
}

function calculateOverallReliability(results) {
  const total = results.length || 1;
  const passCount = results.filter((result) => result.status === "Pass").length;
  const inconsistentCount = results.filter((result) => result.status === "Inconsistent").length;
  const failCount = results.filter((result) => result.status === "Fail").length;

  const passRate = (passCount / total) * 100;
  const avgConsistency =
    results.reduce((sum, result) => sum + result.consistencyScore, 0) / total;
  const avgSeverity =
    results.reduce((sum, result) => sum + result.failureSeverity, 0) / total;
  const severityComponent = Math.max(0, 100 - avgSeverity * 100);

  const reliabilityScore = Math.round(
    passRate * 0.45 + avgConsistency * 0.35 + severityComponent * 0.2
  );

  return {
    reliabilityScore,
    breakdown: {
      passRate: Math.round(passRate),
      averageConsistency: Math.round(avgConsistency),
      severityPenalty: Math.round(avgSeverity * 100),
      correct: passCount,
      failed: failCount,
      inconsistent: inconsistentCount,
      total
    }
  };
}

async function runEvaluations({ mainPrompt, testCases, model, mode, apiKey }) {
  const results = [];
  const client = mode === "live" ? new OpenAI({ apiKey }) : null;

  for (const testCase of testCases) {
    const question = testCase?.question?.trim();
    const expectedKeywords = testCase?.expectedKeywords?.trim() || "";

    if (!question) {
      continue;
    }

    const outputs =
      mode === "live"
        ? await Promise.all(
            Array.from({ length: runCount }, () => generateResponse(client, model, mainPrompt, question))
          )
        : await generateMockRuns(mainPrompt, question, expectedKeywords);

    const baseline = getBaselineAssessment(outputs, expectedKeywords);
    const failureAnalysis = await buildFailureAnalysis(
      client,
      model,
      {
        ...baseline,
        question,
        outputs,
        expectedKeywords
      },
      mode
    );

    results.push({
      question,
      expectedKeywords,
      outputs,
      status: baseline.status,
      consistencyScore: baseline.consistencyScore,
      reason: baseline.reason,
      explanation: baseline.explanation,
      failureReason: failureAnalysis.failureReason,
      failureExplanation: failureAnalysis.failureExplanation,
      failureSeverity: failureAnalysis.failureSeverity,
      shortReason: failureAnalysis.shortReason || baseline.reason,
      showcase: failureAnalysis.showcase
    });
  }

  const summary = calculateOverallReliability(results);
  const failureShowcase = results
    .filter((result) => result.showcase)
    .sort((first, second) => second.failureSeverity - first.failureSeverity)
    .slice(0, 6)
    .map((result) => ({
      prompt: result.question,
      output: result.outputs[0],
      failure: result.failureReason,
      explanation: result.failureExplanation,
      status: result.status
    }));

  return {
    results,
    failureShowcase,
    ...summary
  };
}

export async function executeReliabilityRun({ mainPrompt, testCases, model = "gpt-4o-mini", apiKey }) {
  if (!mainPrompt || !Array.isArray(testCases) || testCases.length === 0) {
    return {
      statusCode: 400,
      body: {
        error: "A main prompt and at least one test case are required."
      }
    };
  }

  try {
    if (!apiKey) {
      const mockRun = await runEvaluations({
        mainPrompt,
        testCases,
        model,
        mode: "mock"
      });

      return {
        statusCode: 200,
        body: {
          ...mockRun,
          mode: "mock",
          notice: "Running in mock mode because no OPENAI_API_KEY was found."
        }
      };
    }

    const liveRun = await runEvaluations({
      mainPrompt,
      testCases,
      model,
      mode: "live",
      apiKey
    });

    return {
      statusCode: 200,
      body: {
        ...liveRun,
        mode: "live",
        notice: "Running with live OpenAI responses."
      }
    };
  } catch (error) {
    console.error(error);

    if (error?.status === 429 || /quota/i.test(error?.message || "")) {
      const mockRun = await runEvaluations({
        mainPrompt,
        testCases,
        model,
        mode: "mock"
      });

      return {
        statusCode: 200,
        body: {
          ...mockRun,
          mode: "mock",
          notice: "OpenAI quota was unavailable, so mock mode was used instead."
        }
      };
    }

    return {
      statusCode: 500,
      body: {
        error: error?.message || "Something went wrong while running tests."
      }
    };
  }
}
