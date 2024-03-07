import { program } from "../../shared";
import * as fs from "fs";
import * as path from "path";
import { readableStreamToText, spawn, type Subprocess } from "bun";

const pwd = process.cwd();

program
	.command("cascade [FILES...]")
	.description(
		"Compiles a series of input files using the output the previous file as compiler for the next.",
	)
	.option("-i, --include <path>", "The include file path to use for NASM", "")
	.action(async (args, options) => {
		console.log("Compiling in cascade mode");
		console.log("Spawning compiler toolchain...");
		console.log("Listening for changes...");

		// Check if every file exists
		args.forEach((file: string) => {
			if (!path.isAbsolute(file)) file = path.join(pwd, file);

			if (!fs.existsSync(file))
				throw new Error(`File ${file} does not exist`);

			// Attach a watcher to the file
			fs.watch(
				file,
				{ recursive: false },
				async (eventType, filename) => {
					console.log(`File ${filename} has been changed`);
					await cascadeCompile();
				}
			);
		});

		if (options.include && !path.isAbsolute(options.include)) {
			options.include = path.join(pwd, options.include);
		}

		const cascadeCompile = async () => {
			// Loop through all files and compile them taking the newly built compiler of the previous iteration
			for (let i = 1; i < args.length; i++) {
				const compiler = args[i - 1];
				const file = args[i];
				const subprocess = spawn({
					cmd: ["./metax", "run", file, "--compiler", compiler],
					stdout: "pipe",
				});
				const output = await readableStreamToText(subprocess.stdout);

				// Write the output to an intermediate .asm file
				fs.writeFileSync(`${file}.asm`, output);

				// Compile the .asm file
				const nasm = await command([
					"nasm",
					"-F",
					"dwarf",
					"-g",
					"-f",
					"elf32",
					"-i",
					options.include,
					"-o",
					`${file}.o`,
					`${file}.asm`,
				]);
				if (nasm.exitCode !== 0) {
					console.log(`Error: ${nasm.stderr}`);
					return;
				}

				// Link the .o file
				const ld = await command([
					"ld",
					"-m",
					"elf_i386",
					"-o",
					`${file}.bin`,
					`${file}.o`,
				]);

				if (ld.exitCode !== 0) {
					console.log(`Error: ${ld.stderr}`);
					return;
				}

				// Remove the intermediate .o file
				fs.rmSync(`${file}.o`);

				// Update the compiler for the next iteration
				args[i] = `${file}.bin`;
			}
		};
	});

async function command(command: string[]): Promise<Subprocess> {
	return new Promise((resolve, reject) => {
		const subprocess = spawn(command, {
			stdout: "pipe",
			onExit: () => {
				resolve(subprocess);
			},
		});
	});
}
