import { program } from "../../shared";
import { error, info } from "../../utils/console";
import * as path from "path"
import * as fs from "fs"
import yaml from "js-yaml";
import { ConfigOptions } from "../../utils/ConfigOptions";
import ora from "ora";
import chalk from "chalk";
import type { TestResult } from "./types";
import { spawnSync } from "bun";


program
	.command("test")
	.description("Runs all specified tests for your project according to the meta-config.json file.")
	.option(
		"-w, --watch",
		"Will watch for changes and re-run tests when a file changes"
	)
	.option(
		"-c, --coverage",
		"Will generate a coverage report"
	)
	.option(
		"-t, --timeout <NUMBER>",
		"The timeout for each test in milliseconds"
	)
	.option(
		"-b, --bail <NUMBER>",
		"Will exit a test suite after <NUMBER> of failures"
	)
	.option(
		"-p, --pattern <STRING>",
		"Will only run tests that match the specified pattern"
	)
	.option(
		"--parallel <NUMBER>",
		"Will make use of parallelized workers to run multiple test using <NUMBER> of processes",
	)
	.option(
		"--reporter <STRING>",
		"The reporter to use for the test results"
	)
	.option(
		"--config <STRING>",
		"The config file to use for the tests"
	)
	.action(async (options) => {
		console.clear();

		if (options.config) {
			info(`Using config file: ${options.config}\n`);
		}

		const configPath = path.resolve(process.cwd(), options.config);
		const config = await Bun.file(configPath).text();

		const parsedConfig = yaml.load(config);

		const validatedConfig = ConfigOptions.safeParse(parsedConfig);

		if (!validatedConfig.success) {
			error(`Invalid config file.\n${validatedConfig.error.errors.map(error => `\t- ${error.message}`)}`);
			process.exit(1);
		}

		const { testOptions } = validatedConfig.data;

		// Override the config with the options passed in the CLI
		const finalOptions = {
			...testOptions,
			...options
		}

		const { testDir } = finalOptions;

		const testDirPath = path.resolve(path.dirname(configPath), testDir);

		if (!fs.existsSync(testDirPath)) {
			error(`The test directory ${testDirPath} does not exist.`);
			process.exit(1);
		}

		const testDirectories = traverse(testDirPath);

		/**
		 * The general structure for tests is as follows:
		 * .
		 * └── <test-name>/
		 * 		├── <name>.meta
		 * 		├── input.<ext>
		 * 		└── output.<ext>
		 * Let's validate the structure of each test.
		 * There may also exist a (test-config|config|settings|meta).yml file that defines specific options for each individual test.
		 * If that is present the structure is irrelevant.
		 */

		const validTestDirectories = [];

		for (let i = 0; i < testDirectories.length; i++) {
			// Check if there is a grammar file present (.meta)
			const dir = testDirectories[i]

			if (dir.type !== "dir") {
				continue;
			}

			const { files } = dir;
			const stagedErrors: string[] = [];

			const directoryStats: TestDirectoryElement = { name: dir.file, path: dir.path };

			directoryStats.meta = files.find(file => file.file.endsWith(".meta"));

			if (!directoryStats.meta) {
				stagedErrors.push(`The test directory ${dir.path} must contain a .meta file.`);
			}

			const inputFiles = files.filter(file => file.file.startsWith("input"));

			if (inputFiles.length !== 1) {
				stagedErrors.push(`The test directory ${dir.path} must contain 1 input file.`);
			} else {
				directoryStats.input = inputFiles[0];
			}

			const outputFiles = files.filter(file => file.file.startsWith("output"));

			if (outputFiles.length !== 1) {
				stagedErrors.push(`The test directory ${dir.path} must contain 1 output file.`);
			} else {
				directoryStats.output = outputFiles[0];
			}

			if (stagedErrors.length > 0) {
				error(`Found errors in the test directory ${dir.path}:\n${stagedErrors.map(error => `\t- ${error}`).join("\n")}`, false);
			} else {
				validTestDirectories.push(directoryStats);
			}
		}
		
		if (validTestDirectories.length === 0) {
			error("No valid tests found.", true);
		}

		const results: TestResult[] = []

		for (const dir of validTestDirectories) {
			// We now need to follow these 3 steps:
			// 1. Compile the grammar file (.meta)
			// 2. Compile the input file using the resulting compiler
			// 3. Compare the output with the expected output

			// Step 1
			// Compile the grammar file

			const spinner = ora(`Running test ${dir.meta.file}`).start();

			const grammarFileContent = await Bun.file(dir.meta.path).text();
			const inputFileContent = await Bun.file(dir.input.path).text();
			const outputFileContent = await Bun.file(dir.output.path).text();

			let compileTime = time(async () => {
				const subprocess = spawnSync([`${path.join(import.meta.dir, "../build/bin/meta-linux-x64.bin")}`, dir.meta.path]);

				if (finalOptions.verbose === "all") {
					spinner.text = `${dir.name} - Compiling ${dir.meta.file}`;
				}
			})

			// Step 2
			// Compile the input file
			let compileInputTime = time(async () => {
				const inputFile = dir.input.path;
				const inputFileOutput = `${inputFile}.out`;

				if (finalOptions.verbose === "all") {
					spinner.text = `${dir.name} - Compiling ${dir.input.file}`;
				}
			})

			// Step 3
			// Compare the output with the expected output
			const outputFile = dir.output.path;
			
			const compareTime = time(async () => {
				if (finalOptions.verbose === "all") {
					spinner.text = `${dir.name} - Comparing ${dir.output.file}`;
				}
			})

			spinner.text = `${dir.name} - Done! 🎉`;
			spinner.succeed()
			if (finalOptions.verbose === "all") {
				console.log(`\t⏰ Compiling ${dir.meta.file} took ${chalk.green(`${Math.round(compileTime * 1000) / 1000}ms`)}`)
				console.log(`\t⏰ Compiling ${dir.input.file} took ${chalk.green(`${Math.round(compileInputTime * 1000) / 1000}ms`)}`)
				// Get the average compile speed in MB/s
				// Given that the compile time is in ms and the grammar file content is in bytes
				const averageCompileSpeed = Math.round((grammarFileContent.length / 1048576) / (compileTime / 1000) * 100) / 100;
				console.log(`\t📈 Average compile speed: ${averageCompileSpeed}MB/s`)
			}

			results.push({
				name: dir.name,
				compileTime,
				compileInputTime,
				compareTime: 0,
				success: false,
				error: ""
			})
		}

		// Add an empty line here.
		console.log();
		

		if (results.filter(result => result.success).length !== validTestDirectories.length) {
			error("Not all tests were executed successfully. Please check the output for more information.", false)
		} else {
			info(`All tests executed ${chalk.green("successfully")} within ${results.reduce((acc, result) => acc + result.compileTime + result.compileInputTime + result.compareTime, 0)}ms. Well done! 🎉`)
		}
	})

	

	// Measures the execution time of a function call
	function time(fn: Function) {
		const start = process.hrtime();
		fn();
		const end = process.hrtime(start);
		const time = end[0] * 1000 + end[1] / 1000000;
		return time;
	}

	type TestDirectoryElement = {
		meta: FileStat,
		input: FileStat,
		output: FileStat,
		name: string,
		path: string
	}


	type FileStat = {
		file: string, 
		path: string,
		type: "file"
	}

	type DirStat = {
		file: string, 
		path: string,
		files: FileStat[],
		type: "dir"
	}

	const traverse = function(dir: string, result: (FileStat | DirStat)[] = []) {
    
    // list files in directory and loop through
    fs.readdirSync(dir).forEach((file) => {
        
        // builds full path of file
        const fPath = path.resolve(dir, file);
        
        // prepare stats obj
        const stats: FileStat | DirStat  = { file, path: fPath };

        // is the file a directory ? 
        // if yes, traverse it also, if no just add it to the result
        if (fs.statSync(fPath).isDirectory()) {
            stats.type = 'dir';
            stats.files = [];
            result.push(stats);
            return traverse(fPath, stats.files)
        }

        stats.type = 'file';
        result.push(stats);
    });
    return result;
};