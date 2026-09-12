import { t as plugin$1 } from "../plugin-DlF-r5D9.mjs";
import { toCompatRule } from "eslint-json-compat-utils";
//#region src/experimental/plugin.ts
const language = "json/json";
const rules$1 = Object.fromEntries(Object.entries(plugin$1.rules).map(([name, rule]) => [name, toCompatRule(rule)]));
for (const rule of Object.values(rules$1)) rule.meta.languages ??= [language];
const plugin = {
	configs: {
		recommended: {
			files: ["**/package.json"],
			language,
			name: "package-json/experimental-recommended",
			plugins: { get "package-json"() {
				return plugin;
			} },
			rules: plugin$1.configs.recommended.rules
		},
		stylistic: {
			files: ["**/package.json"],
			language,
			name: "package-json/experimental-stylistic",
			plugins: { get "package-json"() {
				return plugin;
			} },
			rules: plugin$1.configs.stylistic.rules
		}
	},
	meta: plugin$1.meta,
	rules: rules$1
};
//#endregion
//#region src/experimental/index.ts
const configs = plugin.configs;
const rules = plugin.rules;
var experimental_default = plugin;
//#endregion
export { configs, experimental_default as default, rules };
