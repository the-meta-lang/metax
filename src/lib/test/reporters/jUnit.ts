import type { TestResult } from "../types";
import * as xml from "xml-js";

export const JUnitReporter = (results: TestResult[]) => {
	const elements: xml.Element[] = [];

	for (const result of results) {
		elements.push({
			type: "element",
			name: "testsuite",
			attributes: {
				name: result.name,
				tests: 1,
				failures: result.success ? 0 : 1,
			},
			elements: [
				{
					type: "element",
					name: "testcase",
					attributes: {
						name: result.name,
						time: result.compileTime,
						file: result.name,
					},
					elements: [],
				},
				{
					type: "element",
					name: "system-out",
					elements: [
						{
							type: "text",
							text: result.error,
						},
					],
				},
				{
					type: "element",
					name: "system-err",
					elements: [],
				},
			],
		});
	}

	const json = {
		declaration: {
			attributes: {
				version: "1.0",
				encoding: "utf-8",
			},
		},
		elements: [
			{
				type: "element",
				name: "testsuites",
				attributes: {
					tests: results.length,
					failures: results.filter((result) => !result.success)
						.length,
				},
				elements,
			},
		],
	};

	return xml.json2xml(JSON.stringify(json), {
		compact: false,
	});
};
