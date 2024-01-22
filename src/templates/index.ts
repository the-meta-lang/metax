import { default as defaultTemplate } from "./default/index";
import type { Ora } from "ora";

export type TemplateFunction = (dir: string, options: { dir: string, template: string, deps: boolean, git: boolean }, spinner: Ora) => Promise<void>;

export const templates: Record<string, TemplateFunction> = {
	default: defaultTemplate
}