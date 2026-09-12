import { createRequire } from "node:module";
import * as parserJsonc from "jsonc-eslint-parser";
import { kebabCase } from "change-case";
import { fixRemoveArrayElement, fixRemoveObjectProperty } from "eslint-fix-utils";
import detectIndent from "detect-indent";
import { detectNewlineGraceful } from "detect-newline";
import sortObjectKeys from "sort-object-keys";
import sortPackageJson, { sortOrder } from "sort-package-json";
import semver from "semver";
import { execFileSync } from "node:child_process";
import { validateAuthor, validateBin, validateBrowser, validateBugs, validateBundleDependencies, validateConfig, validateContributors, validateCpu, validateDependencies, validateDescription, validateDevEngines, validateDirectories, validateEngines, validateExports, validateFiles, validateFunding, validateGypfile, validateHomepage, validateKeywords, validateLibc, validateLicense, validateMain, validateMan, validateName, validateOs, validatePackageManager, validatePeerDependenciesMeta, validatePrivate, validatePublishConfig, validateRepository, validateScripts, validateSideEffects, validateType, validateVersion, validateWorkspaces } from "package-json-validator";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { sep } from "node:path/posix";
import { findRootSync } from "@altano/repository-tools";
//#region src/utils/predicates/isJSONNullLiteral.ts
function isJSONNullLiteral(node) {
	return node.type === "JSONLiteral" && node.value === null;
}
//#endregion
//#region src/utils/predicates/isJSONStringLiteral.ts
function isJSONStringLiteral(node) {
	return node.type === "JSONLiteral" && typeof node.value === "string";
}
//#endregion
//#region src/utils/predicates/isNotNullish.ts
function isNotNullish(value) {
	return value !== null && value !== void 0;
}
//#endregion
//#region src/utils/predicates/isPackageJson.ts
const isPackageJson = (filePath) => /(?:^|[/\\])package.json$/.test(filePath);
//#endregion
//#region src/createRule.ts
/**
* Rule options type is inferred from the JSON schema by [json-schema-to-ts](https://www.npmjs.com/package/json-schema-to-ts).
* If you're not satisfied with the inferred type, you may specify it manually in the first type parameter.
*/
function createRule(rule) {
	const ruleGroup = rule.meta.docs?.ruleGroup;
	return {
		create(context) {
			if (!isPackageJson(context.filename)) return {};
			return rule.create(context);
		},
		meta: {
			...rule.meta,
			docs: {
				...rule.meta.docs,
				url: `https://eslint-plugin-package-json.dev/rules/${ruleGroup ? `${ruleGroup}/` : ""}${rule.name}`
			}
		}
	};
}
//#endregion
//#region src/rules/bin-name-casing.ts
const rule$19 = createRule({
	create(context) {
		return { "Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=bin]"(node) {
			if (node.value.type === "JSONObjectExpression") for (const property of node.value.properties) {
				const key = property.key;
				const kebabCaseKey = kebabCase(key.value);
				if (kebabCaseKey !== key.value) context.report({
					data: { property: key.value },
					messageId: "invalidCase",
					node: key,
					suggest: [{
						data: { property: key.value },
						fix: (fixer) => {
							return fixer.replaceText(key, JSON.stringify(kebabCaseKey));
						},
						messageId: "convertToKebabCase"
					}]
				});
			}
		} };
	},
	meta: {
		docs: {
			category: "Stylistic",
			description: "Enforce that names for bin properties are in kebab case."
		},
		hasSuggestions: true,
		messages: {
			convertToKebabCase: "Convert {{ property }} to kebab case.",
			invalidCase: "Command name {{ property }} should be in kebab case."
		},
		schema: [],
		type: "suggestion"
	},
	name: "bin-name-casing"
});
//#endregion
//#region src/rules/exports-subpaths-style.ts
function isImplicitFormat(node) {
	if (node.type === "JSONLiteral") return true;
	return node.properties.every((property) => !isJSONStringLiteral(property.key) || !property.key.value.startsWith("."));
}
const rule$18 = createRule({
	create(context) {
		const [{ prefer = "explicit" } = {}] = context.options;
		function validateForExplicit(node) {
			const { value } = node;
			if (isJSONNullLiteral(value)) return;
			if (value.type !== "JSONLiteral" && value.type !== "JSONObjectExpression" || !isImplicitFormat(value)) return;
			context.report({
				fix(fixer) {
					const valueText = context.sourceCode.getText(value);
					const fixedValue = JSON.stringify({ ".": JSON.parse(valueText) }, null, 2);
					return fixer.replaceText(value, fixedValue);
				},
				messageId: "preferExplicit",
				node: value
			});
		}
		function validateForImplicit(node) {
			const { value } = node;
			if (value.type !== "JSONObjectExpression") return;
			if (value.properties.length !== 1 || !isJSONStringLiteral(value.properties[0].key) || value.properties[0].key.value !== ".") return;
			const dotProperty = value.properties[0];
			if (isJSONNullLiteral(dotProperty.value)) return;
			context.report({
				fix(fixer) {
					const valueText = context.sourceCode.getText(dotProperty.value);
					const fixedValue = JSON.stringify(JSON.parse(valueText), null, 2);
					return fixer.replaceText(value, fixedValue);
				},
				messageId: "preferImplicit",
				node: value
			});
		}
		return { JSONProperty(node) {
			if (node.key.type !== "JSONLiteral" || node.key.value !== "exports" || node.parent.parent.parent.type !== "Program") return;
			if (prefer === "explicit") validateForExplicit(node);
			else validateForImplicit(node);
		} };
	},
	meta: {
		defaultOptions: [{ prefer: "explicit" }],
		docs: {
			category: "Stylistic",
			description: "Enforce consistent format for the exports field (implicit or explicit subpaths).",
			recommended: false
		},
		fixable: "code",
		messages: {
			preferExplicit: "Prefer explicit subpaths format with \".\" key for single root export.",
			preferImplicit: "Prefer implicit format without \".\" key for single root export."
		},
		schema: [{
			additionalProperties: false,
			properties: { prefer: {
				description: "Specifies which exports format to enforce.",
				enum: ["implicit", "explicit"],
				type: "string"
			} },
			type: "object"
		}],
		type: "suggestion"
	},
	name: "exports-subpaths-style"
});
//#endregion
//#region src/rules/no-empty-fields.ts
const getDataAndMessageId = (node) => {
	switch (node.type) {
		case "JSONArrayExpression": return {
			data: { expressionType: "array" },
			messageId: "emptyExpression"
		};
		case "JSONObjectExpression": return {
			data: { expressionType: "object" },
			messageId: "emptyExpression"
		};
		case "JSONProperty": return {
			data: { field: node.key.value },
			messageId: "emptyFields"
		};
	}
};
const report = (context, node) => {
	const { data, messageId } = getDataAndMessageId(node);
	context.report({
		data,
		messageId,
		node,
		suggest: [{
			fix: node.type === "JSONProperty" ? fixRemoveObjectProperty(context, node) : fixRemoveArrayElement(context, node, node.parent),
			messageId: "remove"
		}]
	});
};
const getNode = (node) => {
	return node.parent.type === "JSONProperty" ? node.parent : node;
};
const getTopLevelProperty = (node) => {
	let n = node;
	while (n.parent.parent?.parent?.type !== void 0 && n.parent.parent.parent.type !== "Program") n = n.parent;
	return n.type === "JSONProperty" ? n.key : void 0;
};
const defaultIgnoreProperties = ["files"];
const rule$17 = createRule({
	create(context) {
		const ignoreProperties = new Set(context.options[0]?.ignoreProperties ?? defaultIgnoreProperties);
		return {
			JSONArrayExpression(node) {
				const topLevelProperty = getTopLevelProperty(node);
				if (!topLevelProperty) return;
				if (!node.elements.length) {
					const topLevelPropertyName = topLevelProperty.value;
					if (!ignoreProperties.has(topLevelPropertyName)) report(context, getNode(node));
				}
			},
			JSONObjectExpression(node) {
				const topLevelProperty = getTopLevelProperty(node);
				if (!topLevelProperty) return;
				if (!node.properties.length) {
					const topLevelPropertyName = topLevelProperty.value;
					if (!ignoreProperties.has(topLevelPropertyName)) report(context, getNode(node));
				}
			}
		};
	},
	meta: {
		defaultOptions: [{ ignoreProperties: defaultIgnoreProperties }],
		docs: {
			category: "Best Practices",
			description: "Reports on unnecessary empty arrays and objects.",
			recommended: true
		},
		hasSuggestions: true,
		messages: {
			emptyExpression: "This {{ expressionType }} does nothing and can be removed.",
			emptyFields: "The field '{{ field }}' does nothing and can be removed.",
			remove: "Remove this empty field."
		},
		schema: [{
			additionalProperties: false,
			properties: { ignoreProperties: {
				description: "Array of top-level properties to ignore.",
				items: { type: "string" },
				type: "array"
			} },
			type: "object"
		}],
		type: "suggestion"
	},
	name: "no-empty-fields"
});
//#endregion
//#region src/rules/no-local-dependencies.ts
const isLocalDependency = (value) => value.startsWith("file:") || value.startsWith("link:") || value.startsWith("./") || value.startsWith("../") || value.startsWith(".\\") || value.startsWith("..\\");
const getBundledDependencyNames = (value) => {
	const names = /* @__PURE__ */ new Set();
	if (value?.type === "JSONArrayExpression") for (const element of value.elements.filter(isNotNullish).filter(isJSONStringLiteral)) names.add(element.value);
	return names;
};
const rule$16 = createRule({
	create(context) {
		const ignorePrivate = context.options[0]?.ignorePrivate ?? true;
		let isPrivate = false;
		let dependencyNodes = [];
		const bundleDependencyValues = /* @__PURE__ */ new Map();
		return {
			"Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.type=JSONLiteral]:matches([key.value=bundleDependencies], [key.value=bundledDependencies])"(node) {
				bundleDependencyValues.set(node.key.value, node.value);
			},
			"Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.type=JSONLiteral][value.type=JSONLiteral][key.value=private]"(node) {
				if (node.value.value === true) isPrivate = true;
			},
			"Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.type=JSONLiteral][value.type=JSONObjectExpression][key.value=dependencies]"(node) {
				dependencyNodes = node.value.properties;
			},
			"Program:exit"() {
				if (ignorePrivate && isPrivate) return;
				let bundleDependenciesValue = bundleDependencyValues.get("bundleDependencies");
				if (!(bundleDependenciesValue && (bundleDependenciesValue.type !== "JSONLiteral" || Boolean(bundleDependenciesValue.value)))) bundleDependenciesValue = bundleDependencyValues.get("bundledDependencies");
				if (bundleDependenciesValue?.type === "JSONLiteral" && bundleDependenciesValue.value === true) return;
				const bundledDependencyNames = getBundledDependencyNames(bundleDependenciesValue);
				for (const dependencyPropertyNode of dependencyNodes) {
					const dependencyKey = dependencyPropertyNode.key;
					if (isJSONStringLiteral(dependencyKey) && bundledDependencyNames.has(dependencyKey.value)) continue;
					const dependencyValue = dependencyPropertyNode.value;
					if (isJSONStringLiteral(dependencyValue) && isLocalDependency(dependencyValue.value)) context.report({
						data: { name: dependencyValue.value },
						messageId: "localDependencyFound",
						node: dependencyValue
					});
				}
			}
		};
	},
	meta: {
		defaultOptions: [{ ignorePrivate: true }],
		docs: { description: "Requires that dependencies do not use local file paths, which will likely result in errors when installing from a registry." },
		messages: { localDependencyFound: "Local dependency \"{{ name }}\" is not allowed." },
		schema: [{
			additionalProperties: false,
			properties: { ignorePrivate: {
				description: "Determines if this rule should be enforced when the package's `private` property is `true`.",
				type: "boolean"
			} },
			type: "object"
		}],
		type: "problem"
	},
	name: "no-local-dependencies"
});
//#endregion
//#region src/rules/no-redundant-files.ts
const defaultFiles = [
	/^(\.\/)?LICEN(C|S)E(\.|$)/i,
	/^(\.\/)?README(\.|$)/i,
	/^(\.\/)?package\.json$/i
];
const wildcardsRegex = /[*?[\]{}]/;
const cachedRegex = /* @__PURE__ */ new Map();
const getCachedLocalFileRegex = (filename) => {
	if (wildcardsRegex.test(filename)) return null;
	const baseFilename = filename.replace("./", "");
	let regex = cachedRegex.get(baseFilename);
	if (regex) return regex;
	else {
		regex = new RegExp(`^(./)?${baseFilename}$`, "i");
		cachedRegex.set(baseFilename, regex);
		return regex;
	}
};
const rule$15 = createRule({
	create(context) {
		const entryCache = {
			bin: [],
			files: []
		};
		const report = (elements, index, messageId) => {
			const element = elements[index];
			if (isNotNullish(element) && isJSONStringLiteral(element)) context.report({
				data: { file: element.value },
				messageId,
				node: element,
				suggest: [{
					fix: fixRemoveArrayElement(context, index, elements),
					messageId: "remove"
				}]
			});
		};
		return {
			"Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=bin]"(node) {
				const binValue = node.value;
				if (isJSONStringLiteral(binValue)) entryCache.bin.push(binValue.value);
				else if (binValue.type === "JSONObjectExpression") {
					for (const prop of binValue.properties) if (isJSONStringLiteral(prop.value)) entryCache.bin.push(prop.value.value);
				}
			},
			"Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=files]"(node) {
				if (node.value.type !== "JSONArrayExpression") return;
				const seen = /* @__PURE__ */ new Set();
				const elements = node.value.elements;
				entryCache.files = elements;
				for (const [index, element] of elements.entries()) if (isNotNullish(element) && isJSONStringLiteral(element)) {
					if (seen.has(element.value)) report(elements, index, "duplicate");
					else seen.add(element.value);
					for (const defaultFile of defaultFiles) if (defaultFile.test(element.value)) report(elements, index, "unnecessaryDefault");
				}
			},
			"Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=main]"(node) {
				if (isJSONStringLiteral(node.value)) entryCache.main = node.value.value;
			},
			"Program:exit"() {
				const files = entryCache.files;
				if (files.length === 0) return;
				const validations = [{
					files: entryCache.main ? [entryCache.main] : [],
					messageId: "unnecessaryMain"
				}, {
					files: entryCache.bin,
					messageId: "unnecessaryBin"
				}];
				for (const validation of validations) for (const fileToCheck of validation.files) for (const [index, fileEntry] of files.entries()) if (isNotNullish(fileEntry) && isJSONStringLiteral(fileEntry)) {
					if (getCachedLocalFileRegex(fileEntry.value)?.test(fileToCheck)) report(files, index, validation.messageId);
				}
			}
		};
	},
	meta: {
		docs: {
			category: "Best Practices",
			description: "Prevents adding unnecessary / redundant files.",
			recommended: true
		},
		hasSuggestions: true,
		messages: {
			duplicate: "Files has more than one entry for \"{{file}}\".",
			remove: "Remove this redundant entry.",
			unnecessaryBin: `Explicitly declaring "{{file}}" in "files" is unnecessary; it's included in "bin".`,
			unnecessaryDefault: `Explicitly declaring "{{file}}" in "files" is unnecessary; it's included by default.`,
			unnecessaryMain: `Explicitly declaring "{{file}}" in "files" is unnecessary; it's the "main" entry.`
		},
		schema: [],
		type: "suggestion"
	},
	name: "no-redundant-files"
});
//#endregion
//#region src/rules/no-redundant-publishConfig.ts
const rule$14 = createRule({
	create(context) {
		let packageName;
		let publishConfigAccessProperty;
		return {
			"Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=name]"(node) {
				if (isJSONStringLiteral(node.value)) packageName = node.value.value;
			},
			"Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=publishConfig]"(node) {
				if (node.value.type !== "JSONObjectExpression") return;
				for (const property of node.value.properties) if (isJSONStringLiteral(property.key) && property.key.value === "access") {
					publishConfigAccessProperty = property;
					break;
				}
			},
			"Program:exit"() {
				if (!packageName || !publishConfigAccessProperty) return;
				if (!packageName.startsWith("@")) context.report({
					messageId: "redundantAccess",
					node: publishConfigAccessProperty,
					suggest: [{
						fix: fixRemoveObjectProperty(context, publishConfigAccessProperty),
						messageId: "removeAccess"
					}]
				});
			}
		};
	},
	meta: {
		docs: {
			category: "Best Practices",
			description: "Warns when publishConfig.access is used in unscoped packages.",
			recommended: true
		},
		hasSuggestions: true,
		messages: {
			redundantAccess: "'publishConfig.access' is redundant for unscoped packages - they are always public.",
			removeAccess: "Remove the redundant 'access' field."
		},
		schema: [],
		type: "suggestion"
	},
	name: "no-redundant-publishConfig"
});
//#endregion
//#region src/rules/order-properties.ts
const rule$13 = createRule({
	create(context) {
		return { "Program:exit"() {
			const { ast, text } = context.sourceCode;
			const { order = "sort-package-json" } = context.options[0] ?? {};
			const requiredOrder = order === "sort-package-json" ? sortOrder : order;
			const json = JSON.parse(text);
			const orderedNonStandardKeys = Object.keys(json).filter((key) => !requiredOrder.includes(key)).sort();
			const orderedSource = sortObjectKeys(json, [...requiredOrder, ...orderedNonStandardKeys]);
			const orderedKeys = Object.keys(orderedSource);
			const { properties } = ast.body[0].expression;
			for (let i = 0; i < properties.length; i += 1) {
				const { value } = properties[i].key;
				if (value === orderedKeys[i]) continue;
				context.report({
					data: { property: value },
					fix(fixer) {
						const { indent, type } = detectIndent(text);
						const endCharacters = text.endsWith("\n") ? "\n" : "";
						const newline = detectNewlineGraceful(text);
						let result = JSON.stringify(orderedSource, null, type === "tab" ? "	" : indent) + endCharacters;
						if (newline === "\r\n") result = result.replace(/\n/g, newline);
						return fixer.replaceText(context.sourceCode.ast, result);
					},
					loc: properties[i].loc,
					messageId: "incorrectOrder"
				});
			}
		} };
	},
	meta: {
		defaultOptions: [{ order: "sort-package-json" }],
		docs: {
			category: "Stylistic",
			description: "Enforces that package properties are declared in a consistent order."
		},
		fixable: "code",
		messages: { incorrectOrder: "Top-level property `{{property}}` is not ordered in the standard way." },
		schema: [{
			additionalProperties: false,
			properties: { order: {
				anyOf: [{
					enum: ["sort-package-json"],
					type: ["string"]
				}, {
					items: { type: ["string"] },
					type: ["array"]
				}],
				description: "Specifies the sorting order of top-level properties."
			} },
			type: "object"
		}],
		type: "layout"
	},
	name: "order-properties"
});
//#endregion
//#region src/rules/prefer-rolling-workspace-spec.ts
const rollingWorkspaceSpecRegex = /^workspace:[*^~]?$/;
const convertibleSpecRegex = /^(workspace:[~^])/;
const rule$12 = createRule({
	create(context) {
		const { ignoreDependencies = [], ignorePatterns = [] } = context.options[0] ?? {};
		const ignoreRegexes = ignorePatterns.map((pattern) => new RegExp(pattern));
		const isIgnored = (name) => ignoreDependencies.includes(name) || ignoreRegexes.some((regex) => regex.test(name));
		return { "Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.type=JSONLiteral]:matches([key.value=dependencies], [key.value=devDependencies])"(node) {
			if (node.value.type === "JSONObjectExpression") for (const property of node.value.properties) {
				const key = property.key.value;
				if (isIgnored(key)) continue;
				const valueNode = property.value;
				if (!isJSONStringLiteral(valueNode) || !valueNode.value.startsWith("workspace:")) continue;
				const dependencySpec = valueNode.value;
				if (!rollingWorkspaceSpecRegex.test(dependencySpec)) {
					let conversion;
					const convertibleMatch = convertibleSpecRegex.exec(dependencySpec);
					const rawVersion = dependencySpec.replace("workspace:", "");
					if (convertibleMatch) conversion = convertibleMatch[1];
					else if (semver.parse(rawVersion)) conversion = "workspace:*";
					context.report({
						messageId: "nonRollingWorkspaceSpec",
						node: valueNode,
						suggest: conversion ? [{
							fix: (fixer) => {
								return fixer.replaceText(valueNode, JSON.stringify(conversion));
							},
							messageId: "convertToRolling"
						}] : void 0
					});
				}
			}
		} };
	},
	meta: {
		defaultOptions: [{}],
		docs: {
			category: "Best Practices",
			description: "Require that dependencies declared with workspace protocol use a rolling workspace spec instead of a specific semver range."
		},
		hasSuggestions: true,
		messages: {
			convertToRolling: "Convert to rolling workspace spec",
			nonRollingWorkspaceSpec: "Workspace spec should not include specific semver range. Use a rolling workspace spec instead."
		},
		schema: [{
			additionalProperties: false,
			properties: {
				ignoreDependencies: {
					items: { type: ["string"] },
					type: ["array"],
					description: "Specific dependencies to ignore."
				},
				ignorePatterns: {
					items: { type: ["string"] },
					type: ["array"],
					description: "Regex patterns for dependency names to ignore."
				}
			},
			type: "object"
		}],
		type: "suggestion"
	},
	name: "prefer-rolling-workspace-spec"
});
//#endregion
//#region src/utils/findPropertyWithKeyValue.ts
function findPropertyWithKeyValue(properties, value) {
	return properties.find((property) => property.key.type === "JSONLiteral" && property.key.value === value);
}
//#endregion
//#region src/rules/repository-shorthand.ts
const providerRegexes = {
	bitbucket: /^(?:git\+)?(?:ssh:\/\/git@|http?s:\/\/)?(?:www\.)?bitbucket\.org\//,
	gist: /^(?:git\+)?(?:ssh:\/\/git@|http?s:\/\/)?(?:www\.)?gist\.github\.com\//,
	github: /^(?:git\+)?(?:ssh:\/\/git@|http?s:\/\/)?(?:www\.)?github\.com\//,
	gitlab: /^(?:git\+)?(?:ssh:\/\/git@|http?s:\/\/)?(?:www\.)?gitlab\.com\//
};
const providerUrls = {
	bitbucket: "https://bitbucket.org/",
	gist: "https://gist.github.com/",
	github: "https://github.com/",
	gitlab: "https://gitlab.com/"
};
const providers = Object.keys(providerRegexes);
const isProvider = (value) => value in providerRegexes;
const cleanUrl = (url, provider) => url.replace(providerRegexes[provider], "").replace(/\.git$/, "");
const getProviderFromUrl = (url) => {
	return providers.find((provider) => providerRegexes[provider].test(url));
};
const createShorthand = (url, provider) => {
	return `${provider}:${cleanUrl(url, provider)}`;
};
const createUrl = (shorthand) => {
	if (shorthand.includes(":")) {
		const [provider, repo] = shorthand.split(":", 2);
		if (isProvider(provider)) return `${providerUrls[provider]}${repo}`;
	}
	return `${providerUrls.github}${shorthand}`;
};
const rule$11 = createRule({
	create(context) {
		const [{ form = "object" } = {}] = context.options;
		function validateRepositoryForObject(node) {
			if (isJSONStringLiteral(node.value)) context.report({
				fix(fixer) {
					if (!isJSONStringLiteral(node.value) || node.value.value.split("/").filter(Boolean).length !== 2) return null;
					return fixer.replaceText(node.value, JSON.stringify({
						type: "git",
						url: createUrl(node.value.value)
					}, null, 2));
				},
				messageId: "preferObject",
				node: node.value
			});
		}
		function validateRepositoryForShorthand(node) {
			if (isJSONStringLiteral(node.value)) {
				const { value } = node.value;
				const provider = getProviderFromUrl(value);
				if (provider) context.report({
					fix(fixer) {
						return fixer.replaceText(node.value, JSON.stringify(createShorthand(value, provider)));
					},
					messageId: "preferShorthand",
					node: node.value
				});
				return;
			}
			if (node.value.type !== "JSONObjectExpression") return;
			const { properties } = node.value;
			if (findPropertyWithKeyValue(properties, "directory")) return;
			const typeProperty = findPropertyWithKeyValue(properties, "type");
			if (typeProperty?.value.type !== "JSONLiteral" || typeProperty.value.value !== "git") return;
			const urlProperty = findPropertyWithKeyValue(properties, "url");
			if (urlProperty?.value.type !== "JSONLiteral" || typeof urlProperty.value.value !== "string") return;
			const url = urlProperty.value.value;
			const provider = getProviderFromUrl(url);
			if (provider) context.report({
				fix(fixer) {
					return fixer.replaceText(node.value, JSON.stringify(createShorthand(url, provider)));
				},
				messageId: "preferShorthand",
				node: node.value
			});
		}
		return { JSONProperty(node) {
			if (node.key.type !== "JSONLiteral" || node.key.value !== "repository" || node.parent.parent.parent.type !== "Program") return;
			if (form === "shorthand") validateRepositoryForShorthand(node);
			else validateRepositoryForObject(node);
		} };
	},
	meta: {
		defaultOptions: [{ form: "object" }],
		docs: {
			category: "Best Practices",
			description: "Enforce either object or shorthand declaration for repository.",
			recommended: true
		},
		fixable: "code",
		messages: {
			preferObject: "Prefer an object locator for a repository.",
			preferShorthand: "Prefer a shorthand locator for a supported repository provider."
		},
		schema: [{
			additionalProperties: false,
			properties: { form: {
				description: "Specifies which repository form to enforce.",
				enum: ["object", "shorthand"],
				type: ["string"]
			} },
			type: "object"
		}],
		type: "suggestion"
	},
	name: "repository-shorthand"
});
//#endregion
//#region src/rules/require-attribution.ts
const rule$10 = createRule({
	create(context) {
		const preferContributorsOnly = context.options[0]?.preferContributorsOnly ?? false;
		const ignorePrivate = context.options[0]?.ignorePrivate ?? true;
		let authorPropertyNode;
		let contributorsPropertyNode;
		let isPrivatePackage = false;
		return {
			"Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=author]"(node) {
				authorPropertyNode = node;
			},
			"Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=contributors]"(node) {
				contributorsPropertyNode = node;
				const contributorsValue = node.value;
				if (contributorsValue.type !== "JSONArrayExpression" || contributorsValue.elements.every((element) => !element)) context.report({
					messageId: "noContributors",
					node
				});
			},
			"Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=private]"(node) {
				if (node.value.type === "JSONLiteral" && node.value.value === true) isPrivatePackage = true;
			},
			"Program:exit"() {
				if (ignorePrivate && isPrivatePackage) return;
				if (preferContributorsOnly) {
					if (authorPropertyNode) context.report({
						messageId: "contributorsOnly",
						node: authorPropertyNode,
						suggest: [{
							fix: fixRemoveObjectProperty(context, authorPropertyNode),
							messageId: "removeAuthor"
						}]
					});
					if (!contributorsPropertyNode) context.report({
						loc: {
							column: 0,
							line: 1
						},
						messageId: "missingContributor"
					});
				} else if (!authorPropertyNode && !contributorsPropertyNode) context.report({
					loc: {
						column: 0,
						line: 1
					},
					messageId: "missing"
				});
			}
		};
	},
	meta: {
		defaultOptions: [{
			ignorePrivate: true,
			preferContributorsOnly: false
		}],
		docs: {
			category: "Best Practices",
			description: "Ensures that proper attribution is included, requiring that either `author` or `contributors` is defined, and that if `contributors` is present, it should include at least one contributor.",
			recommended: true
		},
		hasSuggestions: true,
		messages: {
			contributorsOnly: "Only `contributors` should be defined for attribution.",
			missing: "Property attribution is required. Either `author` or `contributors` should be defined.",
			missingContributor: "Property attribution is required. `contributors` should be defined.",
			noContributors: "At least one contributor should be defined.",
			removeAuthor: "Remove `author`."
		},
		schema: [{
			additionalProperties: false,
			properties: {
				ignorePrivate: {
					description: "Skip attribution requirements for packages with `\"private\": true`.",
					type: "boolean"
				},
				preferContributorsOnly: {
					description: "Require that only `contributors` is present, and `author` is not defined.",
					type: "boolean"
				}
			},
			type: "object"
		}],
		type: "suggestion"
	},
	name: "require-attribution"
});
//#endregion
//#region src/utils/createSimpleRequirePropertyRule.ts
/**
* Given a top-level property name, create a rule that requires that property to be present.
* Optionally, include it in the recommended config.
* Note: this will only create a basic require rule, with no options.  If you need
* to create a more complex rule, create it in its own file.
*/
const createSimpleRequirePropertyRule = (propertyName, { category, fixValue, ignorePrivateDefault = false, isRecommended } = {}) => {
	const ruleName = `require-${propertyName}`;
	return {
		rule: createRule({
			create(context) {
				const enforceForPrivate = context.settings.packageJson?.enforceForPrivate;
				const ignorePrivate = context.options[0]?.ignorePrivate ?? (typeof enforceForPrivate === "boolean" ? !enforceForPrivate : ignorePrivateDefault);
				return { "Program > JSONExpressionStatement > JSONObjectExpression"(node) {
					if (ignorePrivate && node.properties.some((property) => isJSONStringLiteral(property.key) && property.key.value === "private" && property.value.type === "JSONLiteral" && property.value.value === true)) return;
					if (node.properties.every((property) => !(isJSONStringLiteral(property.key) && property.key.value === propertyName))) {
						const resolvedValue = typeof fixValue === "function" ? fixValue() : fixValue;
						context.report({
							data: { property: propertyName },
							fix: resolvedValue === void 0 ? void 0 : function* (fixer) {
								yield fixer.insertTextAfterRange([0, 1], `\n  "${propertyName}": ${JSON.stringify(resolvedValue, null, 2).split("\n").join("\n  ")}`);
								yield node.properties.length > 0 ? fixer.insertTextAfterRange([0, 1], ",") : fixer.insertTextAfterRange([0, 1], "\n");
							},
							loc: {
								column: 0,
								line: 1
							},
							messageId: "missing"
						});
					}
				} };
			},
			meta: {
				docs: {
					category,
					description: `Requires the \`${propertyName}\` property to be present.`,
					recommended: isRecommended,
					ruleGroup: "require-properties"
				},
				fixable: fixValue === void 0 ? void 0 : "code",
				messages: { missing: "Property '{{property}}' is required." },
				schema: propertyName === "private" ? [] : [{
					additionalProperties: false,
					properties: { ignorePrivate: {
						default: ignorePrivateDefault,
						description: "Determines if this rule should be enforced when the package's `private` property is `true`.",
						type: "boolean"
					} },
					type: "object"
				}],
				type: "suggestion"
			},
			name: ruleName
		}),
		ruleName
	};
};
//#endregion
//#region src/utils/git/getGitAuthor.ts
let cachedAuthor;
const getGitAuthor = () => {
	if (cachedAuthor === null) return;
	else if (cachedAuthor !== void 0) return cachedAuthor;
	try {
		const name = execFileSync("git", [
			"config",
			"--get",
			"user.name"
		], { encoding: "utf8" }).trim();
		const email = execFileSync("git", [
			"config",
			"--get",
			"user.email"
		], { encoding: "utf8" }).trim();
		cachedAuthor = {
			name,
			...email && { email }
		};
	} catch {
		cachedAuthor = null;
		return;
	}
	return cachedAuthor;
};
const rules$2 = Object.fromEntries([
	["author", { fixValue: getGitAuthor }],
	["bin"],
	["browser"],
	["bugs", { ignorePrivateDefault: true }],
	["bundleDependencies"],
	["config"],
	["contributors"],
	["cpu"],
	["dependencies"],
	["description", { isRecommended: true }],
	["devDependencies"],
	["devEngines"],
	["directories"],
	["engines"],
	["exports", {
		ignorePrivateDefault: true,
		isRecommended: true
	}],
	["files", {
		ignorePrivateDefault: true,
		isRecommended: true
	}],
	["funding"],
	["gypfile"],
	["homepage", { ignorePrivateDefault: true }],
	["keywords", { ignorePrivateDefault: true }],
	["libc"],
	["license", {
		ignorePrivateDefault: true,
		isRecommended: true
	}],
	["main"],
	["man"],
	["module"],
	["name", {
		ignorePrivateDefault: true,
		isRecommended: true
	}],
	["optionalDependencies"],
	["os"],
	["packageManager"],
	["peerDependencies"],
	["peerDependenciesMeta"],
	["private", { fixValue: false }],
	["publishConfig", { ignorePrivateDefault: true }],
	["repository", {
		ignorePrivateDefault: true,
		isRecommended: true
	}],
	["scripts"],
	["sideEffects", {
		ignorePrivateDefault: true,
		isRecommended: true
	}],
	["type", {
		fixValue: "commonjs",
		isRecommended: true
	}],
	["types"],
	["version", {
		ignorePrivateDefault: true,
		isRecommended: true
	}]
].map(([propertyName, options]) => {
	const { rule, ruleName } = createSimpleRequirePropertyRule(propertyName, options);
	return [ruleName, rule];
}));
//#endregion
//#region src/rules/restrict-dependency-ranges.ts
const DEPENDENCY_TYPES = [
	"dependencies",
	"devDependencies",
	"optionalDependencies",
	"peerDependencies"
];
const RANGE_TYPES = [
	{
		symbol: "^",
		alias: "caret",
		workspaceSymbol: "^"
	},
	{
		alias: "pin",
		workspaceSymbol: "*"
	},
	{
		symbol: "~",
		alias: "tilde",
		workspaceSymbol: "~"
	},
	{
		symbol: "<",
		alias: "lt"
	},
	{
		symbol: "<=",
		alias: "le"
	},
	{
		symbol: ">",
		alias: "gt"
	},
	{
		symbol: ">=",
		alias: "ge"
	}
];
const SYMBOLS = RANGE_TYPES.filter((rangeType) => "symbol" in rangeType).map((rangeType) => rangeType.symbol);
const RANGE_NAMES = RANGE_TYPES.map((rangeType) => rangeType.alias);
const SYMBOLS_AND_RANGE_NAMES = [...SYMBOLS, ...RANGE_NAMES];
const schemaOptions = {
	additionalProperties: false,
	properties: {
		forDependencyTypes: {
			description: "Apply a range type restriction for an entire group of dependencies by which type of dependencies they belong to.",
			items: { enum: DEPENDENCY_TYPES },
			type: "array"
		},
		forPackages: {
			description: "The exact name of a package, or a regex pattern used to match a group of packages by name.",
			items: { type: "string" },
			type: "array"
		},
		forVersions: {
			description: "Apply a restriction to a specific semver range.",
			type: "string"
		},
		rangeType: {
			description: "Identifies which range type or types you want to apply to packages that match any of the other match options (or all dependencies if no other options are provided).",
			oneOf: [{ enum: SYMBOLS_AND_RANGE_NAMES }, {
				items: { enum: SYMBOLS_AND_RANGE_NAMES },
				type: "array"
			}]
		}
	},
	required: ["rangeType"],
	type: "object"
};
const normalizeRangeType = (rangeTypeOrSymbol) => RANGE_TYPES.find((rangeType) => "symbol" in rangeType && rangeType.symbol === rangeTypeOrSymbol || rangeType.alias === rangeTypeOrSymbol);
/** @returns `undefined` if workspace versions are not supported for the specified {@link rangeType} */
const getWorkspaceVersionForRange = (rangeType) => {
	if ("workspaceSymbol" in rangeType) return `workspace:${rangeType.workspaceSymbol}`;
};
/** For displaying a range type in a user-facing way (ie. an error message). */
const displayRangeType = (rangeType) => "symbol" in rangeType ? rangeType.symbol : rangeType.alias;
const ROLLING_WORKSPACE_REGEX = /^workspace:[~^*]$/;
const isRollingWorkspaceSpec = (version) => ROLLING_WORKSPACE_REGEX.test(version);
const CHANGE_VERSION_RANGE_REGEX = /^(workspace:)?(\^|~|<=?|>=?)?/;
/**
* Given the original version, update it to use the correct range type.
*/
const changeVersionRange = (version, rangeType) => {
	if (isRollingWorkspaceSpec(version)) {
		const result = getWorkspaceVersionForRange(rangeType);
		if (result !== void 0) return result;
	}
	const replaceWith = "symbol" in rangeType ? rangeType.symbol : "";
	return version.replace(CHANGE_VERSION_RANGE_REGEX, `$1${replaceWith}`);
};
const IS_VERSION_SUPPORTED_REGEX = /^workspace:/;
/**
* Check if the version is in a form that this rule supports.
*/
const isVersionSupported = (version) => {
	if (isRollingWorkspaceSpec(version)) return true;
	const rawVersion = version.replace(IS_VERSION_SUPPORTED_REGEX, "");
	return !!semver.validRange(rawVersion);
};
const POSSIBLE_WORKSPACE_SPEC_REGEX = /(?:workspace:)?[^~]?/;
const rule$9 = createRule({
	create(context) {
		if (!context.options[0]) return {};
		const optionsArray = (Array.isArray(context.options[0]) ? context.options[0].toReversed() : [context.options[0]]).map((option) => ({
			...option,
			forPackages: option.forPackages?.map((pattern) => new RegExp(pattern)),
			rangeTypes: Array.isArray(option.rangeType) ? option.rangeType : [option.rangeType]
		}));
		return { "Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.type=JSONLiteral][value.type=JSONObjectExpression]"(node) {
			const dependencyType = node.key.value;
			if (!DEPENDENCY_TYPES.includes(dependencyType)) return;
			for (const property of node.value.properties) {
				if (!isJSONStringLiteral(property.key) || !isJSONStringLiteral(property.value)) continue;
				const name = property.key.value;
				const version = property.value.value;
				if (!isVersionSupported(version)) continue;
				const doesRangeTypeMatch = (rangeType) => {
					if ("symbol" in rangeType && semver.validRange(version)) return version.startsWith(rangeType.symbol);
					if (rangeType.alias === "pin" && (!!semver.parse(version) || version === "workspace:*" || version === "workspace:")) return true;
					if (version.startsWith("workspace:")) {
						const workspaceVersion = getWorkspaceVersionForRange(rangeType);
						return workspaceVersion === void 0 || version.startsWith(workspaceVersion);
					}
					return false;
				};
				for (const options of optionsArray) {
					if (options.forDependencyTypes && !options.forDependencyTypes.includes(dependencyType)) continue;
					if (options.forPackages) {
						if (!options.forPackages.some((packageNameRegex) => packageNameRegex.test(name))) continue;
					}
					if (options.forVersions && (isRollingWorkspaceSpec(version) || version !== "*" && !semver.satisfies(version.replace(POSSIBLE_WORKSPACE_SPEC_REGEX, ""), options.forVersions))) continue;
					const rangeTypes = options.rangeTypes.map(normalizeRangeType);
					const validRangeTypes = rangeTypes.map(displayRangeType).join(", ");
					if (version === "*") {
						context.report({
							data: { rangeTypes: validRangeTypes },
							messageId: "wrongRangeType",
							node: property.value
						});
						break;
					}
					if (!rangeTypes.some(doesRangeTypeMatch)) context.report({
						data: { rangeTypes: validRangeTypes },
						messageId: "wrongRangeType",
						node: property.value,
						suggest: rangeTypes.map((rangeType) => ({
							fix(fixer) {
								return fixer.replaceText(property.value, `"${changeVersionRange(version, rangeType)}"`);
							},
							messageId: rangeType.alias === "pin" ? "changeToPin" : "changeTo",
							data: rangeType.alias === "pin" ? void 0 : { rangeType: displayRangeType(rangeType) }
						}))
					});
					break;
				}
			}
		} };
	},
	meta: {
		defaultOptions: [[]],
		docs: { description: "Restricts the range of dependencies to allow or disallow specific types of ranges." },
		hasSuggestions: true,
		messages: {
			changeToPin: "Pin the version.",
			changeTo: "Change to use a {{rangeType}} range",
			wrongRangeType: "This dependency is using the wrong range type.  Acceptable range type(s): {{rangeTypes}}"
		},
		schema: [{ oneOf: [schemaOptions, {
			description: "Array of configuration options, specifying range requirements.",
			items: schemaOptions,
			type: "array"
		}] }],
		type: "suggestion"
	},
	name: "restrict-dependency-ranges"
});
//#endregion
//#region src/rules/restrict-private-properties.ts
const defaultBlockedProperties = ["files", "publishConfig"];
const rule$8 = createRule({
	create(context) {
		const blockedProperties = context.options[0]?.blockedProperties ?? defaultBlockedProperties;
		return { "Program > JSONExpressionStatement > JSONObjectExpression"(node) {
			if (node.properties.every((property) => !(isJSONStringLiteral(property.key) && property.key.value === "private" && property.value.type === "JSONLiteral" && property.value.value === true))) return;
			for (const property of node.properties) if (isJSONStringLiteral(property.key) && blockedProperties.includes(property.key.value)) {
				const isEmpty = property.value.type === "JSONArrayExpression" && property.value.elements.length === 0 || property.value.type === "JSONObjectExpression" && property.value.properties.length === 0;
				context.report({
					data: { property: property.key.value },
					messageId: "unnecessaryProperty",
					node: property,
					...isEmpty ? { fix: fixRemoveObjectProperty(context, property) } : { suggest: [{
						data: { property: property.key.value },
						fix: fixRemoveObjectProperty(context, property),
						messageId: "removePropertySuggestion"
					}] }
				});
			}
		} };
	},
	meta: {
		defaultOptions: [{ blockedProperties: defaultBlockedProperties }],
		docs: {
			category: "Best Practices",
			description: "Disallows unnecessary properties in private packages.",
			recommended: false
		},
		fixable: "code",
		hasSuggestions: true,
		messages: {
			removePropertySuggestion: "Remove the '{{ property }}' field.",
			unnecessaryProperty: "The '{{ property }}' field is unnecessary in private packages and can be removed."
		},
		schema: [{
			additionalProperties: false,
			properties: { blockedProperties: {
				description: "Array of property names to disallow in private packages.",
				items: { type: "string" },
				type: "array"
			} },
			type: "object"
		}],
		type: "suggestion"
	},
	name: "restrict-private-properties"
});
//#endregion
//#region src/rules/restrict-top-level-properties.ts
const rule$7 = createRule({
	create(context) {
		const banList = Object.fromEntries(
			/* v8 ignore next - not possible to cover due to presence of `defaultOptions` */
			(context.options[0]?.ban ?? []).map((entry) => typeof entry === "string" ? [entry, ""] : [entry.property, entry.message ?? ""])
		);
		return { "Program > JSONExpressionStatement > JSONObjectExpression"(node) {
			for (const property of node.properties) {
				if (!isJSONStringLiteral(property.key)) continue;
				const propertyName = property.key.value;
				if (Object.hasOwn(banList, propertyName)) {
					const customMessage = banList[propertyName];
					context.report({
						data: {
							customMessage: customMessage ? `: ${customMessage}` : "",
							property: propertyName
						},
						messageId: "bannedProperty",
						node: property.key,
						suggest: [{
							fix: fixRemoveObjectProperty(context, property),
							messageId: "removePropertySuggestion"
						}]
					});
				}
			}
		} };
	},
	meta: {
		defaultOptions: [{ ban: [] }],
		docs: {
			category: "Best Practices",
			description: "Disallows specified top-level properties in package.json.",
			recommended: false
		},
		hasSuggestions: true,
		messages: {
			bannedProperty: "The `{{ property }}` property is not allowed{{ customMessage }}",
			removePropertySuggestion: "Remove the property."
		},
		schema: [{
			additionalProperties: false,
			properties: { ban: {
				description: "List of top-level properties to ban. Each entry can be a property name string or an object with a property name and an optional custom message.",
				items: { oneOf: [{ type: "string" }, {
					additionalProperties: false,
					properties: {
						message: {
							description: "Custom message to append to the error report.",
							type: "string"
						},
						property: {
							description: "The top-level property name to ban.",
							type: "string"
						}
					},
					required: ["property"],
					type: "object"
				}] },
				type: "array"
			} },
			type: "object"
		}],
		type: "suggestion"
	},
	name: "restrict-top-level-properties"
});
//#endregion
//#region src/rules/scripts-name-casing.ts
const BUILT_IN_SCRIPTS_IN_CAMEL_CASE = /* @__PURE__ */ new Set(["prepublishOnly", "pnpm:devPreinstall"]);
const rule$6 = createRule({
	create(context) {
		const { ignoreNames = [], ignorePatterns = [] } = context.options[0] ?? {};
		const ignoreRegexes = ignorePatterns.map((pattern) => new RegExp(pattern));
		const isIgnored = (name) => ignoreNames.includes(name) || ignoreRegexes.some((regex) => regex.test(name));
		return { "Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=scripts]"(node) {
			if (node.value.type === "JSONObjectExpression") for (const property of node.value.properties) {
				const keyNode = property.key;
				const key = keyNode.value;
				if (BUILT_IN_SCRIPTS_IN_CAMEL_CASE.has(key) || isIgnored(key)) continue;
				const kebabCaseKey = (key.startsWith(".") ? key.slice(1) : key).split(":").map((segment) => kebabCase(segment)).join(":");
				if (kebabCaseKey !== (key.startsWith(".") ? key.slice(1) : key)) context.report({
					data: { property: key },
					messageId: "invalidCase",
					node: keyNode,
					suggest: [{
						data: { property: key },
						fix: (fixer) => {
							return fixer.replaceText(keyNode, JSON.stringify(key.startsWith(".") ? `.${kebabCaseKey}` : kebabCaseKey));
						},
						messageId: "convertToKebabCase"
					}]
				});
			}
		} };
	},
	meta: {
		defaultOptions: [{}],
		docs: {
			category: "Stylistic",
			description: "Enforce that names for `scripts` are in kebab case (optionally separated by colons)."
		},
		hasSuggestions: true,
		messages: {
			convertToKebabCase: "Convert {{ property }} to kebab case.",
			invalidCase: "Script name {{ property }} should be in kebab case."
		},
		schema: [{
			additionalProperties: false,
			properties: {
				ignoreNames: {
					items: { type: ["string"] },
					type: ["array"],
					description: "Specific script names to ignore."
				},
				ignorePatterns: {
					items: { type: ["string"] },
					type: ["array"],
					description: "Regex patterns for script names to ignore."
				}
			},
			type: "object"
		}],
		type: "suggestion"
	},
	name: "scripts-name-casing"
});
//#endregion
//#region src/rules/sort-collections.ts
const defaultCollections = /* @__PURE__ */ new Set([
	"config",
	"dependencies",
	"devDependencies",
	"exports",
	"optionalDependencies",
	"overrides",
	"peerDependencies",
	"peerDependenciesMeta",
	"scripts"
]);
const rule$5 = createRule({
	create(context) {
		const toSort = new Map((context.options[0] ?? Array.from(defaultCollections)).map((entry) => typeof entry === "string" ? [entry, null] : [entry.key, entry.order]));
		return { "JSONProperty:exit"(node) {
			const { key: nodeKey, value: collection } = node;
			if (nodeKey.type !== "JSONLiteral" || collection.type !== "JSONObjectExpression") return;
			const keyPartsReversed = [nodeKey.value];
			for (let currNode = node.parent; currNode; currNode = currNode.parent) if (currNode.type === "JSONProperty" && currNode.key.type === "JSONLiteral") keyPartsReversed.push(currNode.key.value);
			else if (currNode.type === "JSONArrayExpression") return;
			const key = keyPartsReversed.reverse().join(".");
			const customOrder = toSort.get(key);
			if (customOrder === void 0) return;
			const currentOrder = collection.properties;
			const isScripts = keyPartsReversed.at(-1) === "scripts";
			let naturalCompare;
			if (isScripts) {
				const scriptsSource = context.sourceCode.getText(node);
				const minimalJson = JSON.parse(`{${scriptsSource}}`);
				const { scripts: sortedScripts } = sortPackageJson(minimalJson);
				const lifecycleIndex = new Map(Object.keys(sortedScripts).map((k, i) => [k, i]));
				naturalCompare = (a, b) => (lifecycleIndex.get(a) ?? 0) - (lifecycleIndex.get(b) ?? 0);
			} else naturalCompare = (a, b) => a > b ? 1 : -1;
			const orderIndex = new Map((customOrder ?? []).map((k, i) => [k, i]));
			const rank = (k) => orderIndex.get(k) ?? orderIndex.size;
			const desiredOrder = currentOrder.toSorted((a, b) => {
				const aKey = a.key.value;
				const bKey = b.key.value;
				const ai = rank(aKey);
				const bi = rank(bKey);
				if (ai !== bi) return ai - bi;
				return naturalCompare(aKey, bKey);
			});
			if (currentOrder.some((property, i) => desiredOrder[i] !== property)) context.report({
				data: { key },
				fix(fixer) {
					const { text } = context.sourceCode;
					const { indent, type } = detectIndent(text);
					const newline = detectNewlineGraceful(text);
					const indentUnit = type === "tab" ? "	" : indent || "  ";
					const jsonLines = JSON.stringify(desiredOrder.reduce((out, property) => {
						out[property.key.value] = JSON.parse(context.sourceCode.getText(property.value));
						return out;
					}, {}), null, indentUnit).split("\n");
					const collectionStartLine = collection.loc.start.line;
					const lineText = context.sourceCode.lines[collectionStartLine - 1];
					const leadingWhitespaceMatch = /^\s*/.exec(lineText);
					const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : "";
					const result = jsonLines.map((l, i) => i === 0 ? l : leadingWhitespace + l).join(newline);
					return fixer.replaceText(collection, result);
				},
				loc: collection.loc,
				messageId: customOrder ? "unsortedOrder" : isScripts ? "unsortedScripts" : "unsortedKeys",
				node
			});
		} };
	},
	meta: {
		defaultOptions: [Array.from(defaultCollections)],
		docs: {
			category: "Best Practices",
			description: "Selected collections must be in a consistent order (lexicographical for most; lifecycle-aware for scripts).",
			recommended: true
		},
		fixable: "code",
		messages: {
			unsortedKeys: "Entries in '{{ key }}' are not in lexicographical order",
			unsortedOrder: "Entries in '{{ key }}' are not in the specified order",
			unsortedScripts: "Entries in 'scripts' are not in lexicographical order and grouped by lifecycles"
		},
		schema: [{
			description: "Array of package properties to require sorting. Provide a string to sort that collection lexicographically (lifecycle-aware for `scripts`), or an object to sort it by a specified order.",
			items: { anyOf: [{ type: "string" }, {
				additionalProperties: false,
				properties: {
					key: {
						description: "The collection property to sort.",
						type: "string"
					},
					order: {
						description: "The order to sort the collection by. Keys not listed are appended in lexicographical order.",
						items: { type: "string" },
						type: "array",
						uniqueItems: true
					}
				},
				required: ["key", "order"],
				type: "object"
			}] },
			type: "array"
		}],
		type: "layout"
	},
	name: "sort-collections"
});
//#endregion
//#region src/rules/specify-peers-locally.ts
const rule$4 = createRule({
	create(context) {
		const devDependencyNames = /* @__PURE__ */ new Set();
		let devDependenciesObjectNode;
		const peerDependencyMap = {};
		return {
			"Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.type=JSONLiteral][value.type=JSONObjectExpression][key.value=devDependencies]"(node) {
				devDependenciesObjectNode = node.value;
				for (const devDependencyPropertyNode of node.value.properties) {
					const dependencyKey = devDependencyPropertyNode.key;
					if (isJSONStringLiteral(dependencyKey)) devDependencyNames.add(dependencyKey.value);
				}
			},
			"Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.type=JSONLiteral][value.type=JSONObjectExpression][key.value=peerDependencies]"(node) {
				for (const peerDependencyPropertyNode of node.value.properties) {
					const dependencyKey = peerDependencyPropertyNode.key;
					if (isJSONStringLiteral(dependencyKey)) peerDependencyMap[dependencyKey.value] = peerDependencyPropertyNode;
				}
			},
			"Program:exit"() {
				for (const [peerDependencyName, peerDependencyNode] of Object.entries(peerDependencyMap)) if (!devDependencyNames.has(peerDependencyName)) {
					const peerDependencyValue = peerDependencyNode.value;
					context.report({
						data: { name: peerDependencyName },
						messageId: "devDependencyNotDefined",
						node: peerDependencyNode,
						suggest: devDependenciesObjectNode && isJSONStringLiteral(peerDependencyValue) ? [{
							data: { name: peerDependencyName },
							fix: (fixer) => {
								const updatedDevDependencies = {
									...JSON.parse(context.sourceCode.getText(devDependenciesObjectNode)),
									[peerDependencyName]: peerDependencyValue.value
								};
								const sortedDevDependencies = Object.fromEntries(Object.entries(updatedDevDependencies).sort((a, b) => a[0] > b[0] ? 1 : -1));
								return fixer.replaceText(devDependenciesObjectNode, JSON.stringify(sortedDevDependencies, null, 2).split("\n").join("\n  "));
							},
							messageId: "addToDevDependencies"
						}] : []
					});
				}
			}
		};
	},
	meta: {
		docs: {
			description: "Requires that all peer dependencies are also declared as dev dependencies",
			recommended: true
		},
		hasSuggestions: true,
		messages: {
			addToDevDependencies: "Add \"{{ name }}\" to `devDependencies`",
			devDependencyNotDefined: "Peer dependency \"{{ name }}\" is not also declared in `devDependencies`."
		},
		schema: [],
		type: "problem"
	},
	name: "specify-peers-locally"
});
//#endregion
//#region src/rules/unique-dependencies.ts
const dependencyPropertyNames = /* @__PURE__ */ new Set([
	"bundledDependencies",
	"bundleDependencies",
	"dependencies",
	"devDependencies",
	"optionalDependencies",
	"overrides",
	"peerDependencies"
]);
const rule$3 = createRule({
	create(context) {
		const dependenciesCache = {
			dependencies: [],
			devDependencies: [],
			peerDependencies: []
		};
		const trackForCrossGroupUniqueness = Object.keys(dependenciesCache);
		function check(elements, getNodeToRemove) {
			const seen = /* @__PURE__ */ new Set();
			for (const element of elements.filter(isNotNullish).filter(isJSONStringLiteral).reverse()) if (seen.has(element.value)) report(element);
			else seen.add(element.value);
			function report(node) {
				const removal = getNodeToRemove(node);
				context.report({
					messageId: "overridden",
					node,
					suggest: [{
						fix: removal.type === "JSONProperty" ? fixRemoveObjectProperty(context, removal) : fixRemoveArrayElement(context, removal, elements),
						messageId: "remove"
					}]
				});
			}
		}
		return {
			"Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.type=JSONLiteral]"(node) {
				if (!dependencyPropertyNames.has(node.key.value)) return;
				const nodeValueType = node.value.type;
				if (nodeValueType === "JSONArrayExpression") check(node.value.elements, (element) => element);
				if (nodeValueType === "JSONObjectExpression") {
					check(node.value.properties.map((property) => property.key), (property) => property.parent);
					if (trackForCrossGroupUniqueness.includes(node.key.value)) dependenciesCache[node.key.value] = node.value.properties;
				}
			},
			"Program:exit"() {
				const dependencyNames = new Set(dependenciesCache.dependencies.map((node) => node.key).filter(isJSONStringLiteral).map((dependencyNameNode) => dependencyNameNode.value));
				if (!dependencyNames.size) return;
				for (const dependencyType of ["devDependencies", "peerDependencies"]) {
					const otherDependencies = dependenciesCache[dependencyType];
					for (const otherDependencyNode of otherDependencies) {
						const otherDependencyKey = otherDependencyNode.key;
						if (isJSONStringLiteral(otherDependencyKey) && dependencyNames.has(otherDependencyKey.value)) context.report({
							messageId: "crossGroupDuplicate",
							node: otherDependencyNode,
							suggest: [{
								fix: fixRemoveObjectProperty(context, otherDependencyNode),
								messageId: "remove"
							}]
						});
					}
				}
			}
		};
	},
	meta: {
		docs: {
			category: "Best Practices",
			description: "Checks a dependency isn't specified more than once (i.e. in `dependencies` and `devDependencies`)",
			recommended: true
		},
		hasSuggestions: true,
		messages: {
			crossGroupDuplicate: "Dependency is also declared in \"dependencies\" and is redundant",
			overridden: "Dependency is overridden by a duplicate entry later on",
			remove: "Remove this redundant dependency"
		},
		schema: [],
		type: "suggestion"
	},
	name: "unique-dependencies"
});
//#endregion
//#region src/rules/valid-author.ts
const rule$2 = createRule({
	create(context) {
		const createFixer = (propertyName, node) => {
			const author = getGitAuthor();
			if (!author) return;
			let mergedAuthor = author;
			const originalValue = JSON.parse(context.sourceCode.getText(node));
			if (originalValue && typeof originalValue === "object" && !Array.isArray(originalValue)) mergedAuthor = {
				name: author.name,
				...originalValue
			};
			switch (propertyName) {
				case "author": return (fixer) => fixer.replaceText(node, JSON.stringify(mergedAuthor, null, 2).split("\n").join("\n  "));
				case "email": return (fixer) => fixer.replaceText(node, JSON.stringify(author.email));
				case "name": return (fixer) => fixer.replaceText(node, JSON.stringify(author.name));
				default: return;
			}
		};
		const reportIssues = (result, node, propertyName) => {
			if (result.errorMessages.length === 0) return;
			if (result.issues.length) for (const issue of result.issues) context.report({
				data: { error: issue.message },
				fix: propertyName === void 0 ? void 0 : createFixer(propertyName, node),
				messageId: "validationError",
				node
			});
			const childrenWithIssues = result.childResults.filter((childResult) => childResult.errorMessages.length);
			if (node.type === "JSONObjectExpression" && childrenWithIssues.length) for (const childResult of childrenWithIssues) {
				const childNode = node.properties[childResult.index];
				const childPropertyName = childNode.key;
				reportIssues(childResult, childNode.value, isJSONStringLiteral(childPropertyName) ? childPropertyName.value : void 0);
			}
		};
		return { "Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=author]"(node) {
			const valueNode = node.value;
			const value = JSON.parse(context.sourceCode.getText(valueNode));
			const result = validateAuthor(value);
			reportIssues(result, valueNode, "author");
		} };
	},
	meta: {
		docs: {
			category: "Best Practices",
			description: "Enforce that the `author` property is valid.",
			recommended: true,
			ruleGroup: "valid-properties"
		},
		fixable: "code",
		messages: { validationError: `Invalid author: {{ error }}` },
		schema: [],
		type: "problem"
	},
	name: "valid-author"
});
//#endregion
//#region src/rules/valid-peerDependenciesMeta-relationship.ts
const rule$1 = createRule({
	create(context) {
		const peerDependencies = /* @__PURE__ */ new Set();
		const peerDependenciesMeta = /* @__PURE__ */ new Map();
		return {
			"Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=peerDependencies]"(node) {
				if (node.value.type === "JSONObjectExpression") {
					for (const property of node.value.properties) if (isJSONStringLiteral(property.key)) peerDependencies.add(property.key.value);
				}
			},
			"Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=peerDependenciesMeta]"(node) {
				if (node.value.type === "JSONObjectExpression") {
					for (const property of node.value.properties) if (isJSONStringLiteral(property.key)) peerDependenciesMeta.set(property.key.value, property);
				}
			},
			"Program:exit"() {
				for (const [dependencyName, propertyNode] of peerDependenciesMeta) if (!peerDependencies.has(dependencyName)) context.report({
					data: { dependencyName },
					messageId: "unnecessaryPeerDependency",
					node: propertyNode,
					suggest: [{
						fix: fixRemoveObjectProperty(context, propertyNode),
						messageId: "removePeerDependencyMeta"
					}]
				});
			}
		};
	},
	meta: {
		docs: {
			category: "Best Practices",
			description: "Enforces that any dependencies declared in `peerDependenciesMeta` are also defined in the package's `peerDependencies`.",
			recommended: true
		},
		hasSuggestions: true,
		messages: {
			removePeerDependencyMeta: "Remove from `peerDependenciesMeta`.",
			unnecessaryPeerDependency: "Dependency '{{ dependencyName }}' is declared in `peerDependenciesMeta` but not in `peerDependencies`."
		},
		schema: [],
		type: "problem"
	},
	name: "valid-peerDependenciesMeta-relationship"
});
//#endregion
//#region src/utils/createSimpleValidPropertyRule.ts
/**
* Given a top-level property name, and a validation function, create a rule that validates the property using the validation function.
* These rules will always be included in the recommended config.
* Note: this will only create a basic validation rule, with no options.  If you need
* to create a more complex rule, create it in its own file.
*/
const createSimpleValidPropertyRule = (propertyName, validationFunction, aliases = []) => {
	const ruleName = `valid-${propertyName}`;
	const propertyNames = [propertyName, ...aliases];
	return {
		rule: createRule({
			create(context) {
				const reportIssues = (result, node) => {
					if (result.errorMessages.length === 0) return;
					if (result.issues.length) for (const issue of result.issues) context.report({
						data: { error: issue.message },
						messageId: "validationError",
						node
					});
					const childrenWithIssues = result.childResults.filter((childResult) => childResult.errorMessages.length);
					if (node.type === "JSONObjectExpression" && childrenWithIssues.length) for (const childResult of childrenWithIssues) {
						const childNode = node.properties[childResult.index];
						reportIssues(childResult, childNode.value);
					}
					else if (node.type === "JSONArrayExpression" && childrenWithIssues.length) for (const childResult of childrenWithIssues) {
						const childNode = node.elements[childResult.index];
						if (childNode) reportIssues(childResult, childNode);
					}
				};
				return propertyNames.reduce((acc, name) => {
					acc[`Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=${name}]`] = (node) => {
						const valueNode = node.value;
						const result = validationFunction(JSON.parse(context.sourceCode.getText(valueNode)));
						reportIssues(result, valueNode);
					};
					return acc;
				}, {});
			},
			meta: {
				docs: {
					category: "Best Practices",
					description: `Enforce that the \`${propertyName}\`${aliases.length ? ` (also ${aliases.map((alias) => `\`${alias}\``).join(", ")})` : ""} property is valid.`,
					recommended: true,
					ruleGroup: "valid-properties"
				},
				messages: { validationError: `Invalid ${propertyName}: {{ error }}` },
				schema: [],
				type: "problem"
			},
			name: ruleName
		}),
		ruleName
	};
};
//#endregion
//#region src/utils/packageManager/constants.ts
const AGENTS = [
	"npm",
	"yarn",
	"pnpm",
	"bun",
	"deno",
	"nub",
	"aube"
];
const LOCK_FILES = {
	"aube-lock.yaml": "aube",
	"aube-workspace.yaml": "aube",
	"bun.lock": "bun",
	"bun.lockb": "bun",
	"deno.lock": "deno",
	"nub.lock": "nub",
	"pnpm-lock.yaml": "pnpm",
	"pnpm-workspace.yaml": "pnpm",
	"yarn.lock": "yarn",
	"package-lock.json": "npm",
	"npm-shrinkwrap.json": "npm"
};
//#endregion
//#region src/utils/packageManager/detectPackageManager.ts
let packageManagerCache;
const userAgentRegex = /^(.+?)\/(\S+)?/;
function getPackageManagerFromUserAgent() {
	const userAgentMatch = process.env.npm_config_user_agent?.match(userAgentRegex);
	if (userAgentMatch) {
		const name = userAgentMatch[1];
		const version = userAgentMatch[2];
		if (AGENTS.includes(name)) return {
			name,
			version
		};
	}
	return null;
}
function setPackageManagerCache(result) {
	packageManagerCache = result;
	return packageManagerCache;
}
function* lookup(cwd = process.cwd()) {
	let directory = path.resolve(cwd);
	const { root } = path.parse(directory);
	while (directory && directory !== root) {
		yield directory;
		directory = path.dirname(directory);
	}
}
function parsePackageJson(filepath) {
	if (!filepath || !fs.existsSync(filepath)) return null;
	return handlePackageManager(filepath);
}
/**
* Detects the package manager used in the project.
* @returns The detected package manager or `null` if not found.
*/
function detectPackageManager() {
	if (packageManagerCache) return packageManagerCache;
	const cwd = process.cwd();
	const strategies = [
		"lockfile",
		"packageManager-field",
		"user-agent"
	];
	for (const directory of lookup(cwd)) for (const strategy of strategies) switch (strategy) {
		case "lockfile":
			if (fs.existsSync(path.join(directory, "rush.json"))) return setPackageManagerCache({ name: "pnpm" });
			for (const lock of Object.keys(LOCK_FILES)) if (fs.existsSync(path.join(directory, lock))) {
				const name = LOCK_FILES[lock];
				return setPackageManagerCache(parsePackageJson(path.join(directory, "package.json")) ?? { name });
			}
			break;
		case "packageManager-field": {
			const result = parsePackageJson(path.join(directory, "package.json"));
			if (result) return setPackageManagerCache(result);
			break;
		}
		case "user-agent": {
			const result = getPackageManagerFromUserAgent();
			if (result) return setPackageManagerCache(result);
			break;
		}
	}
	return null;
}
function getNameAndVersion(pkg) {
	const normalizeVersion = (version) => version?.match(/\d+(?:\.\d+){0,2}/)?.[0] ?? version;
	if (typeof pkg.packageManager === "string") {
		const [name, version] = pkg.packageManager.replace(/^\^/, "").split("@", 2);
		return {
			name,
			version: normalizeVersion(version)
		};
	}
	if (typeof pkg.devEngines?.packageManager?.name === "string") return {
		name: pkg.devEngines.packageManager.name,
		version: normalizeVersion(pkg.devEngines.packageManager.version)
	};
}
function handlePackageManager(filepath) {
	try {
		const content = fs.readFileSync(filepath, "utf8");
		const nameAndVer = getNameAndVersion(JSON.parse(content));
		if (nameAndVer) return {
			name: nameAndVer.name,
			version: nameAndVer.version
		};
	} catch {}
	return null;
}
//#endregion
//#region src/rules/valid-properties.ts
const packageManagerAwareValidateDependencies = (value) => {
	const result = detectPackageManager();
	if (result?.name === "pnpm") {
		const version = result.version;
		const isValidSemver = !!semver.valid(version);
		const isValidRange = !!semver.validRange(version);
		if (!version || isValidSemver && semver.gte(version, "11.1.0") || isValidRange && semver.satisfies("11.1.0", version)) return validateDependencies(value, { allowNamedRegistries: true });
	}
	return validateDependencies(value);
};
/** All basic valid- flavor rules */
const rules$1 = Object.fromEntries([
	["bin", validateBin],
	["browser", validateBrowser],
	["bugs", validateBugs],
	["bundleDependencies", {
		aliases: ["bundledDependencies"],
		validator: validateBundleDependencies
	}],
	["config", validateConfig],
	["contributors", validateContributors],
	["cpu", validateCpu],
	["description", validateDescription],
	["dependencies", packageManagerAwareValidateDependencies],
	["devDependencies", packageManagerAwareValidateDependencies],
	["devEngines", validateDevEngines],
	["directories", validateDirectories],
	["engines", validateEngines],
	["exports", validateExports],
	["files", validateFiles],
	["funding", validateFunding],
	["gypfile", validateGypfile],
	["homepage", validateHomepage],
	["keywords", validateKeywords],
	["libc", validateLibc],
	["license", validateLicense],
	["main", validateMain],
	["man", validateMan],
	["module", validateMain],
	["name", validateName],
	["optionalDependencies", validateDependencies],
	["os", validateOs],
	["packageManager", validatePackageManager],
	["peerDependencies", validateDependencies],
	["peerDependenciesMeta", validatePeerDependenciesMeta],
	["private", validatePrivate],
	["publishConfig", validatePublishConfig],
	["repository", validateRepository],
	["scripts", validateScripts],
	["sideEffects", validateSideEffects],
	["type", validateType],
	["version", validateVersion],
	["workspaces", validateWorkspaces]
].map(([propertyName, validationFunctionOrOptions]) => {
	let validationFunction;
	let aliases = [];
	if (typeof validationFunctionOrOptions === "object") {
		validationFunction = validationFunctionOrOptions.validator;
		aliases = validationFunctionOrOptions.aliases;
	} else validationFunction = validationFunctionOrOptions;
	const { rule, ruleName } = createSimpleValidPropertyRule(propertyName, validationFunction, aliases);
	return [ruleName, rule];
}));
//#endregion
//#region src/rules/valid-repository-directory.ts
/**
* Checks if the child path appears at the end of the parent path.
* @example '/a/b/c', 'c' => true
* @example '/a/b/c', 'b/c' => true
* @example '/a/b/c', 'b' => false
* @example '/a/b/c', 'd' => false
*/
const pathEndsWith = (parent, child) => {
	if (parent === child) return true;
	const segments = parent.split(path.sep);
	let pathToCheck = "";
	return segments.reverse().some((segment) => {
		pathToCheck = path.join(segment, pathToCheck);
		return pathToCheck === child;
	});
};
let repoRootCache = null;
const rule = createRule({
	create(context) {
		return { "Program > JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=repository][value.type=JSONObjectExpression]"(node) {
			const directoryProperty = findPropertyWithKeyValue(node.value.properties, "directory");
			if (directoryProperty?.value.type !== "JSONLiteral" || typeof directoryProperty.value.value !== "string") return;
			const directoryValue = directoryProperty.value.value;
			const fileDirectory = path.normalize(path.dirname(context.filename));
			let repositoryRoot;
			if (repoRootCache && fileDirectory.startsWith(repoRootCache)) repositoryRoot = repoRootCache;
			else {
				repositoryRoot = findRootSync(fileDirectory);
				if (repositoryRoot) repoRootCache = path.normalize(repositoryRoot);
			}
			if (repositoryRoot) {
				const expected = path.relative(repositoryRoot, fileDirectory).replaceAll(path.sep, sep);
				if (expected !== directoryValue) context.report({
					messageId: "mismatched",
					node: directoryProperty.value,
					suggest: [{
						data: { expected },
						fix(fixer) {
							return fixer.replaceText(directoryProperty.value, `"${expected}"`);
						},
						messageId: "replace"
					}]
				});
			} else if (!pathEndsWith(fileDirectory, path.normalize(directoryValue))) context.report({
				messageId: "mismatched",
				node: directoryProperty.value
			});
		} };
	},
	meta: {
		docs: {
			category: "Best Practices",
			description: "Enforce that if repository directory is specified, it matches the path to the package.json file",
			recommended: true
		},
		hasSuggestions: true,
		messages: {
			mismatched: "Directory does not match package.json directory.",
			replace: "Replace with '{{ expected }}'."
		},
		schema: [],
		type: "suggestion"
	},
	name: "valid-repository-directory"
});
//#endregion
//#region src/plugin.ts
const require = createRequire(import.meta.url);
const rules = {
	"bin-name-casing": rule$19,
	"exports-subpaths-style": rule$18,
	"no-empty-fields": rule$17,
	"no-local-dependencies": rule$16,
	"no-redundant-files": rule$15,
	"no-redundant-publishConfig": rule$14,
	"order-properties": rule$13,
	"prefer-rolling-workspace-spec": rule$12,
	"require-attribution": rule$10,
	...rules$2,
	"repository-shorthand": rule$11,
	"restrict-dependency-ranges": rule$9,
	"restrict-private-properties": rule$8,
	"restrict-top-level-properties": rule$7,
	"scripts-name-casing": rule$6,
	"sort-collections": rule$5,
	"specify-peers-locally": rule$4,
	"unique-dependencies": rule$3,
	"valid-author": rule$2,
	...rules$1,
	"valid-peerDependenciesMeta-relationship": rule$1,
	"valid-repository-directory": rule
};
const recommendedRules = { ...Object.fromEntries(Object.entries(rules).filter(([, rule]) => rule.meta.docs?.recommended).map(([name]) => ["package-json/" + name, "error"])) };
const recommendedPublishableRules = {
	...recommendedRules,
	...Object.fromEntries(Object.entries(rules).filter(([, rule]) => rule.meta.docs?.category === "Publishable").map(([name]) => ["package-json/" + name, "error"]))
};
const stylisticRules = { ...Object.fromEntries(Object.entries(rules).filter(([, rule]) => rule.meta.docs?.category === "Stylistic").map(([name]) => ["package-json/" + name, "error"])) };
const { name, version } = require("../package.json");
const plugin = {
	configs: {
		recommended: {
			files: ["**/package.json"],
			languageOptions: { parser: parserJsonc },
			name: "package-json/recommended",
			plugins: { get "package-json"() {
				return plugin;
			} },
			rules: recommendedRules
		},
		/** @deprecated use the recommended config instead. this config will be removed in a future major release */
		"recommended-publishable": {
			files: ["**/package.json"],
			languageOptions: { parser: parserJsonc },
			name: "package-json/recommended-publishable",
			plugins: { get "package-json"() {
				return plugin;
			} },
			rules: recommendedPublishableRules
		},
		stylistic: {
			files: ["**/package.json"],
			languageOptions: { parser: parserJsonc },
			name: "package-json/stylistic",
			plugins: { get "package-json"() {
				return plugin;
			} },
			rules: stylisticRules
		}
	},
	meta: {
		name,
		version
	},
	rules
};
//#endregion
export { plugin as t };
