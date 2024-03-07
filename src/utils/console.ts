import chalk from "chalk";

export const info = (message: string) => {
	console.log(`${chalk.bgBlue("[INFO]")} ${message}`);
}

export const error = (message: string) => {
	console.log(`${chalk.bgRed("[ERROR]")} ${message}`);
	process.exit(1);
}

export const warn = (message: string) => {
	console.log(`${chalk.bgYellow("[WARN]")} ${message}`);
}