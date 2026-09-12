import { n as PackageJsonRuleModule, r as JSONSchema, t as PackageJsonPluginSettings } from "../createRule-CSNxd7i2.mjs";
import { ESLint as ESLint$1 } from "eslint";
//#region src/experimental/plugin.d.ts
declare const plugin: {
  configs: {
    recommended: {
      files: string[];
      language: string;
      name: string;
      plugins: {
        readonly 'package-json': ESLint$1.Plugin;
      };
      rules: {
        [k: string]: "error";
      };
    };
    stylistic: {
      files: string[];
      language: string;
      name: string;
      plugins: {
        readonly 'package-json': ESLint$1.Plugin;
      };
      rules: {
        [k: string]: "error";
      };
    };
  };
  meta: {
    name: string;
    version: string;
  };
  rules: {
    [k: string]: PackageJsonRuleModule<unknown[], JSONSchema[]>;
  };
};
//#endregion
//#region src/experimental/index.d.ts
export declare const configs: {
  recommended: {
    files: string[];
    language: string;
    name: string;
    plugins: {
      readonly 'package-json': import("eslint").ESLint.Plugin;
    };
    rules: {
      [k: string]: "error";
    };
  };
  stylistic: {
    files: string[];
    language: string;
    name: string;
    plugins: {
      readonly 'package-json': import("eslint").ESLint.Plugin;
    };
    rules: {
      [k: string]: "error";
    };
  };
};
export declare const rules: {
  [k: string]: PackageJsonRuleModule<unknown[], JSONSchema[]>;
};
//#endregion
export { type PackageJsonPluginSettings, plugin as default };