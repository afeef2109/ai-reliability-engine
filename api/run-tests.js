import { executeReliabilityRun } from "../lib/reliability.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  const outcome = await executeReliabilityRun({
    ...req.body,
    apiKey: process.env.OPENAI_API_KEY
  });

  return res.status(outcome.statusCode).json(outcome.body);
}
