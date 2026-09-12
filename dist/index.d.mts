import { n as PackageJsonRuleModule, r as JSONSchema, t as PackageJsonPluginSettings } from "./createRule-CSNxd7i2.mjs";
import * as parserJsonc from "jsonc-eslint-parser";
import { ESLint as ESLint$1 } from "eslint";
//#region src/plugin.d.ts
declare const plugin: {
  configs: {
    recommended: {
      files: string[];
      languageOptions: {
        parser: typeof parserJsonc;
      };
      name: string;
      plugins: {
        readonly 'package-json': ESLint$1.Plugin;
      };
      rules: {
        [k: string]: "error";
      };
    };
    /** @deprecated use the recommended config instead. this config will be removed in a future major release */
    'recommended-publishable': {
      files: string[];
      languageOptions: {
        parser: typeof parserJsonc;
      };
      name: string;
      plugins: {
        readonly 'package-json': ESLint$1.Plugin;
      };
      rules: {
        [x: string]: "error";
      };
    };
    stylistic: {
      files: string[];
      languageOptions: {
        parser: typeof parserJsonc;
      };
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
  rules: Record<string, PackageJsonRuleModule<unknown[], JSONSchema[]>>;
};
//#endregion
//#region src/index.d.ts
export declare const rules: Record<string, PackageJsonRuleModule<unknown[], JSONSchema[]>>;
export declare const configs: {
  recommended: {
    files: string[];
    languageOptions: {
      parser: typeof import("jsonc-eslint-parser");
    };
    name: string;
    plugins: {
      readonly 'package-json': import("eslint").ESLint.Plugin;
    };
    rules: {
      [k: string]: "error";
    };
  };
  'recommended-publishable': {
    files: string[];
    languageOptions: {
      parser: typeof import("jsonc-eslint-parser");
    };
    name: string;
    plugins: {
      readonly 'package-json': import("eslint").ESLint.Plugin;
    };
    rules: {
      [x: string]: "error";
    };
  };
  stylistic: {
    files: string[];
    languageOptions: {
      parser: typeof import("jsonc-eslint-parser");
    };
    name: string;
    plugins: {
      readonly 'package-json': import("eslint").ESLint.Plugin;
    };
    rules: {
      [k: string]: "error";
    };
  };
};
//#endregion
export { type PackageJsonPluginSettings, plugin as default };