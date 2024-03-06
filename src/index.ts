#!/usr/bin/env node

import { simpleGit } from 'simple-git';
import { program } from "./shared";
import chalk from "chalk";
import inquirer from "inquirer";
import { randomVerbAndNoun } from "./utils/randomVerbAndNoun";
import * as fs from "fs";
import * as path from "path";
import { templates } from './templates';
import ora from 'ora';
import os from "node:os";
import { readableStreamToText, spawn, type Subprocess } from 'bun';

const pwd = process.cwd();

program
	.name("metax")
	.description("CLI for the META Compiler writing library")
	.version("0.1.0")

if (os.platform() === "win32") {
	// Add a warning to the help text if the user is running Windows
	program.addHelpText("beforeAll", `${chalk.bgYellow("Warning")} Please note you are running in Windows Compatibility mode. Not all functionality has been fully tested and you may encounter errors. If you do, please report them to us by creating a new Issue on GitHub.\n`)
}

const primaryColor = chalk.bgHex("#dc8850").bold;
const accentColor = chalk.bgHex("#ef9995").bold.black;

// Add equal amounts of padding to the left and right of a string so that it reaches the specified length
const padHorizontal = (str: string, length: number): string => {
	const paddingLength = Math.round((length - str.length) / 2);
	const padding = " ".repeat(paddingLength);

	return `${padding}${str}${padding}`;
}

const emptyLine = () => console.log();

const defaultPrefix = primaryColor(padHorizontal("metax", 6));

const log = (message: string) => console.log(`${defaultPrefix} ${message}`);

const PADDING_LENGTH = 6;

program
	.command("init")
	.description("Creates a new META project and initializes all needed files")
	.option(
		"--template <STRING>",
		"The template to use for your project",
		"default"
	)
	.action(async (options) => {
		console.log(
			`${chalk.bgGreen(
				"metax"
			)} Initializing project with template ${chalk.bgBlue(
				options.template
			)}`
		);
		console.log();

		const response = await inquirer.prompt([
			{
				message: "Where should we create your new project?",
				prefix: `${accentColor(padHorizontal("dir", PADDING_LENGTH))}`,
				default: `./${randomVerbAndNoun()}`,
				type: "input",
				name: "dir",
			},
			// Optional overwrite
			{
				message:
					"The directory you specified already exists. Would you like to overwrite it?",
				prefix: `${accentColor(padHorizontal("force", PADDING_LENGTH))}`,
				type: "confirm",
				name: "overwrite",
				when: (answers) => {
					// Check if the directory exists
					if (fs.existsSync(path.join(pwd, answers.dir))) {
						return true;
					}

					return false;
				},
				validate: (answer) => {
					if (answer === false) {
						console.log(`${chalk.bgRed("metax")} Aborting...`);
					}
				},
			},
			{
				message:
					"How would you like to get started with your new project?",
				prefix: `${accentColor(padHorizontal("tmp", PADDING_LENGTH))}`,
				type: "list",
				name: "template",
				choices: [{
					name: `Include sample files ${chalk.dim("(recommended)")}`,
					value: "default"
				}, {
					name: "Start with a blank project",
					value: "empty"
				}],
				when: (answers) => {
					if (options.template === "default") {
						return true;
					}

					return false;
				}
			},
			{
				message: `Install dependencies? ${chalk.dim("(recommended)")}`,
				prefix: `${accentColor(padHorizontal("dep", PADDING_LENGTH))}`,
				type: "confirm",
				name: "deps",
				default: true,
			},
			{
				message: "Initialize a new git repository?",
				prefix: `${accentColor(padHorizontal("git", PADDING_LENGTH))}`,
				type: "confirm",
				default: true,
				name: "git",
			},
		]);

		const dir = path.join(pwd, response.dir);

		if (fs.existsSync(dir) && response.overwrite === true) {
			fs.rmSync(dir, { recursive: true, force: true });

			log(
				`Removed existing directory ${chalk.bgBlue(dir)}`
			);
		}

		fs.mkdirSync(dir);

		emptyLine()

		log(
				`Created directory ${chalk.bgBlue(
					response.dir
				)}`
			);

		emptyLine()

		// Create a new git repository if the user wants to
		if (response.git === true) {
			const git = simpleGit(dir);

			git.init();

			emptyLine()

			log(
				`Initialized git repository`
			);

			emptyLine()
		}

		// Copy the template files
		if (options.template) {
			const template = templates[options.template];

			const spinner = ora("Copying template files").start();

			await template(dir, response, spinner);
		}
	});

program
	.command("build")
	.description("Builds your project according to the meta-config.json file")
	.option(
		"--no-emit",
		"Whether or not to emit the compiled files",
		false
	)

program
	.command("run <FILE>")
	.description("Takes in a METALS or x86 assembler and compiles the specified file into a compiler executable")
	.option(
		"-i, --x86",
		"Whether or not the assembler is written in x86 instead of METALS. The program will try to figure it out automatically if not specified.",
		false
	)
	.option(
		"-o, --output <FILE>",
		"The file to output the compiler executable to",
		""
	)
	.option(
		"--force",
		"Overwrite the output file if it already exists",
		false
	)
	.option(
		"-l, --lib <FILE>",
		"The file to link the compiler executable against",
		""
	)
	.option(
		"-d, --debug",
		"Run the compiler in debug mode",
		false
	)
	.option(
		"-c, --clean",
		"Clean up temporary files after compilation",
		false
	)
	.option(
		"--compiler <STRING>",
		"The compiler to use for compilation, you can use 'nasm', 'gcc' or 'builtin' as values. More granular control can be achieved by providing a custom command using the --command option or specifying the 'build' options in your local meta-config.json.",
		"builtin"
	)
	.option(
		"--command <STRING>",
		"A custom command to use for compilation, this will override the --compiler option",
		""
	)
	.option(
		"--gyro",
		"Will try to use Gyro as a runtime to compile the file, please note that this is experimental and may not work as expected.",
		false
	)
	.option(
		"--vm",
		"Will spin up a local VM to run the compiler in, this is especially useful for testing, a web interface will be launched on http://localhost to visualize register and memory allocation. Please note that this will automatically enable the --debug flag.",
	)
	.action(async (file: string, options) => {
		// Check if the file exists
		if (!fs.existsSync(file))
			throw new Error(`File ${file} does not exist`);

		if (options.output && !path.isAbsolute(options.output)) {
			options.output = path.join(pwd, options.output);

			// Check if the output file already exists
			if (fs.existsSync(options.output) && !options.force) {
				throw new Error(`Warning: Output file ${options.output} already exists. Use --force to overwrite it.`);
			}
		}

		let filePathCompiler = path.join(pwd, options.compiler);

		if (options.compiler === "builtin" || options.compiler === "") {
			filePathCompiler = path.join(import.meta.dir, "../bin/meta.bin");
		}

		// Check if the compiler is valid
		if (!fs.existsSync(filePathCompiler)) {
			throw new Error(`Compiler ${options.compiler} does not exist`);
		}

		// Compile the file
		const subprocess = spawn({ cmd: [filePathCompiler, file], stdout: "pipe" })
		const output = await readableStreamToText(subprocess.stdout);

		if (options.output) {
			fs.writeFileSync(options.output, output);
		} else {
			console.log(output);
		}
	})

program
	.command("test")
	.description("Runs all specified tests for your project according to the meta-config.json file.")
	.option(
		"-w, --watch",
		"Will watch for changes and re-run tests when a file changes",
		false
	)
	.option(
		"-c, --coverage",
		"Will generate a coverage report",
		false
	)
	.option(
		"-t, --timeout <NUMBER>",
		"The timeout for each test in milliseconds",
		"5000"
	)
	.option(
		"-b, --bail <NUMBER>",
		"Will exit a test suite after <NUMBER> of failures",
		"1"
	)
	.option(
		"-p, --pattern <STRING>",
		"Will only run tests that match the specified pattern",
		""
	)
	.option(
		"--parallel <NUMBER>",
		"Will make use of parallelized workers to run multiple test using <NUMBER> of processes",
		"1"
	)

program.
	command("cascade [FILES...]")
	.description("Creates a cascading compiler toolchain, this is especially useful when trying to implement new features or optimizations in subimplementations of the compiler itself. It will compile all input files from left to right if any of them change always taking the newly built compiler of the previous iteration.")
	.option("-i, --include <path>",
	"The include file path to use for NASM", "")
	.action(async (args, options) => {
		console.log("Compiling in cascade mode");
		console.log("Spawning compiler toolchain...")
		console.log("Listening for changes...")

		// Check if every file exists
		args.forEach((file: string) => {
			if (!path.isAbsolute(file))
				file = path.join(pwd, file);

			if (!fs.existsSync(file))
				throw new Error(`File ${file} does not exist`);

			// Attach a watcher to the file
			fs.watch(file, { recursive: false }, async (eventType, filename) => {
				console.log(`File ${filename} has been changed`);
				await cascadeCompile();
			});
		})

		if (options.include && !path.isAbsolute(options.include)) {
			options.include = path.join(pwd, options.include);
		}

		const cascadeCompile = async () => {
			// Loop through all files and compile them taking the newly built compiler of the previous iteration
			for (let i = 1; i < args.length; i++) {
				const compiler = args[i - 1];
				const file = args[i];
				const subprocess = spawn({ cmd: ["./metax", "run", file, "--compiler", compiler], stdout: "pipe" })
				const output = await readableStreamToText(subprocess.stdout);

				// Write the output to an intermediate .asm file
				fs.writeFileSync(`${file}.asm`, output);

				// Compile the .asm file
				const nasm = await command(["nasm", "-F", "dwarf", "-g", "-f", "elf32", "-i", options.include, "-o", `${file}.o`, `${file}.asm`])
				if (nasm.exitCode !== 0) {
					console.log(`Error: ${nasm.stderr}`);
					return;
				}

				// Link the .o file
				const ld = await command(["ld", "-m", "elf_i386", "-o", `${file}.bin`, `${file}.o`]);
				
				if (ld.exitCode !== 0) {
					console.log(`Error: ${ld.stderr}`);
					return;
				}

				// Remove the intermediate .o file
				fs.rmSync(`${file}.o`);

				// Update the compiler for the next iteration
				args[i] = `${file}.bin`;
			}
		}
	})

	async function command(command: string[]): Promise<Subprocess> {
		return new Promise((resolve, reject) => {
			const subprocess = spawn(command, { stdout: "pipe", onExit: () => {
				resolve(subprocess)
			} });
		})
	}

program.parse();
