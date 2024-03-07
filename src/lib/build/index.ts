import { program } from "../../shared";
import * as fs from "fs";
import { error, info, warn } from "../../utils/console";
import { z } from "zod";

const pwd = process.cwd();

program
	.command("build")
	.description("Builds your project according to the meta-config.json file")
	.option(
		"--config <path>",
		"The path to the configuration file, if not given it will default to meta-config.json",
		`${pwd}/meta-config.json`
	)
	.action(async (options) => {
		// Check if the config file exists
		if (!fs.existsSync(options.config))
			error(`Config file ${options.config} does not exist`);

		info("Building your project...");
		info("Using the following configuration file: " + options.config);

		const config = await Bun.file(options.config).json();

		// Check if the compiler is valid
		const configValidator = z.object({
			compiler: z
				.string()
				.optional()
				.default(`${import.meta.dir}/bin/meta-linux-x64.bin`),
			compilerOptions: z
				.object({
					debug: z.boolean().optional().default(false),
					verbose: z.number().optional().default(0),
					watch: z.boolean().optional().default(false),
					target: z
						.enum([
							"c",
							"cpp",
							"rust",
							"javascript",
							"native",
							"asm",
							"metals",
						])
						.describe(
							"If the META file is configured to output METALS, this can be set to any available compilation target and will generate a compiler for that specific language: e.g. 'javascript'"
						),
					out: z.string().describe("The output file path"),
					entry: z.string().describe("The entry file path"),
				})
				.strict(),
		});

		const result = configValidator.safeParse(config);

		if (!result.success) {
			error(
				`Invalid configuration file: \n${result.error.errors
					.map((error) => `	- ${error.message}`)
					.join("\n")}`
			);
		}

		console.log(result.data);
	});
