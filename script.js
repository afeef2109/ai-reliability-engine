const mainPromptInput = document.getElementById("main-prompt");
const testCasesContainer = document.getElementById("test-cases-container");
const addTestCaseButton = document.getElementById("add-test-case-button");
const runTestsButton = document.getElementById("run-tests-button");
const runDemoButton = document.getElementById("run-demo-button");
const loadingIndicator = document.getElementById("loading-indicator");
const errorMessage = document.getElementById("error-message");
const resultsBody = document.getElementById("results-body");
const reliabilityScore = document.getElementById("reliability-score");
const modeNotice = document.getElementById("mode-notice");
const template = document.getElementById("test-case-template");

const demoCases = [
  { question: "What is the capital of France?", expectedKeywords: "Paris" },
  { question: "Solve 2+2", expectedKeywords: "4" },
  { question: "Name a color of the sky", expectedKeywords: "blue" }
];

function createTestCaseCard(values = { question: "", expectedKeywords: "" }) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".test-case-card");
  const [questionInput, keywordsInput] = card.querySelectorAll("input");
  const removeButton = card.querySelector("[data-remove]");

  questionInput.value = values.question || "";
  keywordsInput.value = values.expectedKeywords || "";

  removeButton.addEventListener("click", () => {
    card.remove();
    ensureAtLeastOneTestCase();
  });

  testCasesContainer.appendChild(card);
}

function ensureAtLeastOneTestCase() {
  if (testCasesContainer.children.length === 0) {
    createTestCaseCard();
  }
}

function collectTestCases() {
  return [...testCasesContainer.querySelectorAll(".test-case-card")].map((card) => ({
    question: card.querySelector('[data-field="question"]').value.trim(),
    expectedKeywords: card.querySelector('[data-field="expectedKeywords"]').value.trim()
  }));
}

function setLoading(isLoading) {
  loadingIndicator.classList.toggle("hidden", !isLoading);
  runTestsButton.disabled = isLoading;
  runDemoButton.disabled = isLoading;
  addTestCaseButton.disabled = isLoading;
}

function renderResults(results = []) {
  if (results.length === 0) {
    resultsBody.innerHTML = `
      <tr class="empty-state-row">
        <td colspan="3">Run a demo or add your own tests to see reliability results.</td>
      </tr>
    `;
    reliabilityScore.classList.add("hidden");
    return;
  }

  resultsBody.innerHTML = results
    .map((result) => {
      const statusClass = `status-${result.status.toLowerCase()}`;
      const expectedLine = result.expectedKeywords
        ? `<div class="meta-text">Expected keyword(s): ${escapeHtml(result.expectedKeywords)}</div>`
        : "";

      return `
        <tr>
          <td>
            <strong>${escapeHtml(result.question)}</strong>
            ${expectedLine}
          </td>
          <td>
            <div class="output-block">
              <div class="output-run">
                <span class="output-label">Run 1</span>
                <div class="output-text">${escapeHtml(result.output || "No output returned.")}</div>
              </div>
              <div class="output-run">
                <span class="output-label">Run 2</span>
                <div class="output-text">${escapeHtml(result.outputSecondRun || "No output returned.")}</div>
              </div>
              <div class="meta-text">${escapeHtml(result.reason || "")}</div>
            </div>
          </td>
          <td>
            <span class="status-badge ${statusClass}">${escapeHtml(result.status)}</span>
          </td>
        </tr>
      `;
    })
    .join("");
}

function updateReliabilityScore(score) {
  reliabilityScore.textContent = `Reliability Score: ${score}%`;
  reliabilityScore.classList.remove("hidden");
}

function updateModeNotice(notice, mode) {
  if (!notice) {
    modeNotice.textContent = "";
    modeNotice.classList.add("hidden");
    return;
  }

  modeNotice.textContent =
    mode === "mock" ? `${notice} These outputs are simulated for demo/testing use.` : notice;
  modeNotice.classList.remove("hidden");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function runTests() {
  errorMessage.textContent = "";

  const mainPrompt = mainPromptInput.value.trim();
  const testCases = collectTestCases().filter((testCase) => testCase.question);

  if (!mainPrompt) {
    errorMessage.textContent = "Enter a main prompt before running tests.";
    return;
  }

  if (testCases.length === 0) {
    errorMessage.textContent = "Add at least one test case with a question.";
    return;
  }

  setLoading(true);

  try {
    const response = await fetch("/api/run-tests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mainPrompt,
        testCases,
        model: "gpt-4o-mini"
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Failed to run tests.");
    }

    renderResults(payload.results);
    updateReliabilityScore(payload.reliabilityScore);
    updateModeNotice(payload.notice, payload.mode);
  } catch (error) {
    renderResults([]);
    updateModeNotice("", "");
    errorMessage.textContent =
      error instanceof TypeError
        ? "Could not reach the app server. Start it with `npm start` and open the app at http://localhost:3000."
        : error.message;
  } finally {
    setLoading(false);
  }
}

async function runDemo() {
  mainPromptInput.value = "You are a helpful assistant";
  testCasesContainer.innerHTML = "";
  demoCases.forEach((testCase) => createTestCaseCard(testCase));
  await runTests();
}

addTestCaseButton.addEventListener("click", () => createTestCaseCard());
runTestsButton.addEventListener("click", runTests);
runDemoButton.addEventListener("click", runDemo);

demoCases.forEach((testCase) => createTestCaseCard(testCase));
renderResults([]);
updateModeNotice("", "");
