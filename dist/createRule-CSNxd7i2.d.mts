import { AST, RuleListener } from "jsonc-eslint-parser";
import { AST as AST$1, Rule, SourceCode } from "eslint";
import * as ESTree from "estree";
//#region node_modules/.pnpm/json-schema-to-ts@3.1.1/node_modules/json-schema-to-ts/lib/types/definitions/jsonSchema.d.ts
declare const $JSONSchema: unique symbol;
type $JSONSchema = typeof $JSONSchema;
type JSONSchemaType = "string" | "number" | "integer" | "boolean" | "object" | "array" | "null";
type JSONSchema = boolean | Readonly<{
  [$JSONSchema]?: $JSONSchema;
  $id?: string | undefined;
  $ref?: string | undefined;
  $schema?: string | undefined;
  $comment?: string | undefined;
  type?: JSONSchemaType | readonly JSONSchemaType[];
  const?: unknown;
  enum?: unknown;
  multipleOf?: number | undefined;
  maximum?: number | undefined;
  exclusiveMaximum?: number | undefined;
  minimum?: number | undefined;
  exclusiveMinimum?: number | undefined;
  maxLength?: number | undefined;
  minLength?: number | undefined;
  pattern?: string | undefined;
  items?: JSONSchema | readonly JSONSchema[];
  additionalItems?: JSONSchema;
  contains?: JSONSchema;
  maxItems?: number | undefined;
  minItems?: number | undefined;
  uniqueItems?: boolean | undefined;
  maxProperties?: number | undefined;
  minProperties?: number | undefined;
  required?: readonly string[];
  properties?: Readonly<Record<string, JSONSchema>>;
  patternProperties?: Readonly<Record<string, JSONSchema>>;
  additionalProperties?: JSONSchema;
  unevaluatedProperties?: JSONSchema;
  dependencies?: Readonly<Record<string, JSONSchema | readonly string[]>>;
  propertyNames?: JSONSchema;
  if?: JSONSchema;
  then?: JSONSchema;
  else?: JSONSchema;
  allOf?: readonly JSONSchema[];
  anyOf?: readonly JSONSchema[];
  oneOf?: readonly JSONSchema[];
  not?: JSONSchema;
  format?: string | undefined;
  contentMediaType?: string | undefined;
  contentEncoding?: string | undefined;
  definitions?: Readonly<Record<string, JSONSchema>>;
  title?: string | undefined;
  description?: string | undefined;
  default?: unknown;
  readOnly?: boolean | undefined;
  writeOnly?: boolean | undefined;
  examples?: readonly unknown[];
  nullable?: boolean;
}>;
//#endregion
//#region src/createRule.d.ts
type ASTBodyExpression = ESTree.Expression & {
  properties: ASTBodyProperty[];
};
type ASTBodyProperty = AST.JSONProperty & {
  value: string;
};
interface ASTBodyStatement extends ESTree.ExpressionStatement {
  expression: ASTBodyExpression;
}
interface PackageAST extends AST$1.Program {
  body: [ASTBodyStatement];
}
interface PackageJsonPluginSettings {
  /**
   * Whether `require-*` rules, if used, should enforce the presence of
   * the corresponding property *in package.json files with `"private": true`*.
   *
   * If not specified, it will not enforce the presence only of `name` and `version` properties.
   */
  enforceForPrivate?: boolean;
}
interface PackageJsonRuleContext<Options extends unknown[] = unknown[]> extends Rule.RuleContext {
  options: Options;
  settings: {
    packageJson?: PackageJsonPluginSettings;
  };
  sourceCode: PackageJsonSourceCode;
}
interface PackageJsonRuleModule<Options extends unknown[] = unknown[], Schema extends JSONSchema[] = JSONSchema[]> {
  create(context: PackageJsonRuleContext<Options>): RuleListener;
  meta: Omit<Rule.RuleMetaData, 'defaultOptions' | 'docs' | 'schema'> & {
    defaultOptions?: NoInfer<Options>;
    docs?: Rule.RuleMetaData['docs'] & {
      category?: string;
      /** An optional route segment to group this rule under */
      ruleGroup?: string;
    };
    schema?: Schema;
  };
}
interface PackageJsonSourceCode extends SourceCode {
  ast: PackageAST;
}
//#endregion
export { PackageJsonRuleModule as n, JSONSchema as r, PackageJsonPluginSettings as t };