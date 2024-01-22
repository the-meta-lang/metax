#!/usr/bin/env node

import { simpleGit } from 'simple-git';
import { program } from "./shared";
import chalk from "chalk";
import inquirer from "inquirer";
import { randomVerbAndNoun } from "./randomVerbAndNoun";
import * as fs from "fs";
import * as path from "path";
import { templates } from './templates';
import ora from 'ora';

const pwd = process.cwd();

program
	.name("metax")
	.description("CLI for the META Compiler writing library")
	.version("0.1.0");

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
	.command("run <ASSEMBLER> <FILE>")
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
		"--object-file",
		"Whether or not the assembler was provided as a compiled object file instead of a source file, this will skip compilation and linking.",
		false
	)
	.option(
		"-l, --lib <FILE>",
		"The file to link the compiler executable against",
		""
	)
	.option(
		"-d, --debug",
		"Whether or not to compile in debug mode",
		false
	)
	.option(
		"-c, --clean",
		"Whether or not to clean up temporary files after compilation",
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

program.parse();
