import { z } from "zod";

export const ConfigOptions = z.object({
	testOptions: z.object({

		// Reporter
		reporter: z.string().default("junit"),
		reporterOutput: z.string().default("test-results.xml"),

		// Entry directories
		testDir: z.string().default("test"),

		// Benchmarking
		// Enables benchmarking for the test suite.
		benchmark: z.boolean().default(false),
		// Enables the profiler to view method calls and their duration
		profile: z.boolean().default(false),

		// Verbosity
		verbose: z.enum(["warn", "error", "all"]).default("all"),

		bail: z.number().describe("The number of failures after which to bail out the test.").default(1),
		timeout: z.number().describe("The timeout for each test in milliseconds.").default(5000),
		coverage: z.boolean().default(false),
		watch: z.boolean().default(false),
		pattern: z.string().default(""),
		parallel: z.number().default(1),
	})
})