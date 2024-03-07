import type { Ora } from "ora";
import path from "path";
import fs from "fs";
import { format } from "../../utils/format";

export default async (dir: string, options: { dir: string, template: string, deps: boolean, git: boolean }, spinner: Ora) => {

	// Create all the directories
	const src = path.join(dir, "src");
	const lib = path.join(src, "lib");
	const dist = path.join(dir, "dist");

	fs.mkdirSync(src);
	fs.mkdirSync(lib);
	fs.mkdirSync(dist);

	const name = path.basename(dir);

	// Create the main file
	fs.writeFileSync(path.join(lib, "tokens.meta"), "");

	// Create the meta-config.json file
	fs.writeFileSync(path.join(dir, "meta-config.json"), `{
	"name": "${name}",
	"version": "1.0.0",
	"description": "",
	"main": "src/index.meta",
	"scripts": {
		"build": "meta build",
		"start": "meta run"
	},
	"keywords": [],
	"author": "",
	"license": "ISC",
	"dependencies": {},
	"devDependencies": {}
}`);

	if (options.git) {
		// Create the .gitignore file
		fs.writeFileSync(path.join(dir, ".gitignore"), `dist`);
	}

	fs.copyFileSync(path.join(import.meta.dir, "files/index.meta"), path.join(src, "index.meta"));

	// Create the README.md file
	const readMe = await Bun.file(path.join(import.meta.dir, "files/README.md")).text();
	const readMeFormatted = format(readMe, { name })
	fs.writeFileSync(path.join(dir, "README.md"), readMeFormatted);


	spinner.succeed("Created template files");
}