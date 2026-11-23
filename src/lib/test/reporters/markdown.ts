import type { TestResult } from "../types";

let index = 0;
let totalTests = 0;
let failedTests = 0;
let failedTestDetails: string[] = [];
let allTests: TestResult[] = [];

export function MarkdownReporter(results: TestResult[]) {
	for (const result of results) {
		totalTests += 1;
		if (!result.success) {
			failedTests += 1;
			failedTestDetails.push(
				`${result.name}\n\n\`\`\`\n${result.error}\n\`\`\``
			);
		}
		allTests.push(result);

		outputText();
		outputSummary();
	}
}

function outputText() {
  console.log("### Test Failures:");
  if (failedTestDetails.length > 0) {
    for (let index = 0; index < failedTestDetails.length; index++) {
      console.log("- " + failedTestDetails[index]);
    }
  } else if (totalTests > 0) {
    console.log("No failing tests, awesome!");
  } else {
    console.log("No tests found.");
  }
}

function outputSummary() {
  console.log("### Testing Summary:");
  console.log(" ");
  console.log("- " + totalTests + " Total test(s)");
  console.log("- " + (totalTests - failedTests) + " Successful test(s)");
  console.log("- " + failedTests + " Failed test(s)");
}