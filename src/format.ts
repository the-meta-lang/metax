

/**
 * Formats a string with the given values
 * Will replace any double braces with the value of the key inside the braces
 * @param str {string} The string to format
 * @param values {Record<string, string | number>} The values to replace in the string. The key is the value to replace, the value is the value to replace it with.
 * @returns {string} The formatted string
 */
export function format(str: string, values: Record<string, string | number>): string {
	return str.replace(/{{(.+?)}}/g, (_,g1) => values[g1] || g1)
}