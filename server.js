import dotenv from "dotenv";
import express from "express";
import { executeReliabilityRun } from "./lib/reliability.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("."));
app.use(express.static("public"));

app.post("/api/run-tests", async (req, res) => {
  const outcome = await executeReliabilityRun({
    ...req.body,
    apiKey: process.env.OPENAI_API_KEY
  });

  return res.status(outcome.statusCode).json(outcome.body);
});

app.listen(port, () => {
  console.log(`AI Reliability Tester listening on http://localhost:${port}`);
});
