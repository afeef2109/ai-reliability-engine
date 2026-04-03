import OpenAI from "openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";

function createClient() {
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "AI Reliability Engine"
    }
  });
}

function parseStrictJson(value = "") {
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);

    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function fallbackAnalysis(aiResponse) {
  return {
    score: 45,
    risk_level: "Medium",
    issues: ["JSON parsing fallback used", "Analysis may be incomplete"],
    highlighted_error: aiResponse.split(" ").slice(0, 6).join(" "),
    explanation:
      "The reliability evaluator did not return valid JSON, so a fallback analysis was generated."
  };
}

async function generateAiResponse(prompt) {
  const client = createClient();
  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant. Answer the user's prompt directly."
      },
      {
        role: "user",
        content: prompt
      }
    ]
  });

  return response.choices?.[0]?.message?.content?.trim() || "";
}

async function analyzeReliability(prompt, aiResponse) {
  const client = createClient();
  const analysisPrompt = `
You are an AI reliability evaluator.
Analyze the following AI response and return STRICT JSON with:
- score (0-100)
- risk_level (Low, Medium, High)
- issues (array of short reasons)
- highlighted_error (exact part of text that may be wrong or risky)
- explanation (short explanation why it's unreliable)

User prompt:
${prompt}

AI response:
${aiResponse}
`;

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: "user",
        content: analysisPrompt
      }
    ]
  });

  return response.choices?.[0]?.message?.content?.trim() || "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: "Missing OPENROUTER_API_KEY in environment variables."
    });
  }

  const prompt = req.body?.prompt?.trim();

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  try {
    const aiResponse = await generateAiResponse(prompt);
    const rawAnalysis = await analyzeReliability(prompt, aiResponse);
    const parsed = parseStrictJson(rawAnalysis);

    const analysis = parsed
      ? {
          score: Number(parsed.score) || 0,
          risk_level: parsed.risk_level || "Medium",
          issues: Array.isArray(parsed.issues) ? parsed.issues : ["Unknown issue"],
          highlighted_error: parsed.highlighted_error || "",
          explanation: parsed.explanation || "No explanation returned."
        }
      : fallbackAnalysis(aiResponse);

    return res.status(200).json({
      prompt,
      aiResponse,
      analysis
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Failed to analyze reliability."
    });
  }
}
