export type TestResult = {
	name: string,
	compileTime: number,
	compileInputTime: number,
	compareTime: number,
	success: boolean,
	error: string
}