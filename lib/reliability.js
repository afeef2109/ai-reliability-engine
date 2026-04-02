import OpenAI from "openai";

const minWordCount = 3;
const similarityThreshold = 0.45;
const mockDelayMs = 450;

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

function evaluateStatus(primaryOutput, secondaryOutput, expectedKeywords = "") {
  const keywords = expectedKeywords
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  const missingInFirstRun = keywords.filter(
    (keyword) => !normalizeText(primaryOutput).includes(normalizeText(keyword))
  );
  const missingInSecondRun = keywords.filter(
    (keyword) => !normalizeText(secondaryOutput).includes(normalizeText(keyword))
  );

  if (getWordCount(primaryOutput) < minWordCount || getWordCount(secondaryOutput) < minWordCount) {
    return {
      status: "Fail",
      reason: "One of the responses is too short."
    };
  }

  if (missingInFirstRun.length > 0 || missingInSecondRun.length > 0) {
    const missingKeywords = [...new Set([...missingInFirstRun, ...missingInSecondRun])];
    return {
      status: "Fail",
      reason: `Missing expected keyword(s): ${missingKeywords.join(", ")}.`
    };
  }

  const similarity = jaccardSimilarity(primaryOutput, secondaryOutput);

  if (similarity < similarityThreshold) {
    return {
      status: "Inconsistent",
      reason: "The two runs produced meaningfully different answers."
    };
  }

  return {
    status: "Pass",
    reason: "Outputs were sufficiently complete and consistent."
  };
}

function buildMockResponse(mainPrompt, question, expectedKeywords, runNumber) {
  const normalizedQuestion = normalizeText(question);
  const keywords = expectedKeywords
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
  const firstKeyword = keywords[0] || "";

  if (normalizedQuestion.includes("capital of france")) {
    return runNumber === 1
      ? "The capital of France is Paris."
      : "The capital of France is Paris, a major European city.";
  }

  if (normalizedQuestion.includes("2+2") || normalizedQuestion.includes("solve 2+2")) {
    return runNumber === 1 ? "2 + 2 equals 4." : "2 + 2 equals 4, so the answer is 4.";
  }

  if (normalizedQuestion.includes("color of the sky")) {
    return runNumber === 1
      ? "A common color of the sky is blue."
      : "Blue is one color people often see in the sky.";
  }

  if (normalizedQuestion.includes("one word") || normalizedQuestion.includes("brief")) {
    return runNumber === 1 ? "Okay." : "Sure.";
  }

  const keywordSnippet = firstKeyword ? ` Include ${firstKeyword} in the answer.` : "";
  const styleSnippet = mainPrompt ? `Following the prompt "${mainPrompt}", ` : "";

  return runNumber === 1
    ? `${styleSnippet}this mock response addresses the question "${question}" clearly.${keywordSnippet}`.trim()
    : `${styleSnippet}this simulated answer responds to "${question}" in a slightly different but related way.${keywordSnippet}`.trim();
}

async function generateMockPair(mainPrompt, question, expectedKeywords) {
  await new Promise((resolve) => setTimeout(resolve, mockDelayMs));

  return [
    buildMockResponse(mainPrompt, question, expectedKeywords, 1),
    buildMockResponse(mainPrompt, question, expectedKeywords, 2)
  ];
}

async function generateResponse(client, model, mainPrompt, question) {
  const completion = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: mainPrompt
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: question
          }
        ]
      }
    ]
  });

  return completion.output_text?.trim() || "";
}

async function runEvaluations({ mainPrompt, testCases, model, mode, apiKey }) {
  const results = [];
  const client = mode === "live" ? new OpenAI({ apiKey }) : null;

  for (const testCase of testCases) {
    const question = testCase?.question?.trim();
    const expectedKeywords = testCase?.expectedKeywords?.trim() || "";

    if (!question) {
      results.push({
        question: "",
        output: "",
        outputSecondRun: "",
        status: "Fail",
        reason: "Question is empty.",
        expectedKeywords
      });
      continue;
    }

    const [firstRun, secondRun] =
      mode === "live"
        ? await Promise.all([
            generateResponse(client, model, mainPrompt, question),
            generateResponse(client, model, mainPrompt, question)
          ])
        : await generateMockPair(mainPrompt, question, expectedKeywords);

    const evaluation = evaluateStatus(firstRun, secondRun, expectedKeywords);

    results.push({
      question,
      output: firstRun,
      outputSecondRun: secondRun,
      expectedKeywords,
      ...evaluation
    });
  }

  const passedCount = results.filter((result) => result.status === "Pass").length;
  const reliabilityScore = Math.round((passedCount / results.length) * 100);

  return {
    results,
    reliabilityScore
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
