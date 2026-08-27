// @ts-check
import { mergeBuildLines } from "./logic";

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  return mergeBuildLines(input);
}
