import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([
    "**/dist/",
    "**/node_modules/",
    "client/public/generated/",
    ".venv/",
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
    },
  },
  {
    files: ["sim/src/world/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='Math'][property.name!=/^(imul|floor|abs|min|max)$/]",
          message: "Worldgen must be bit-identical in every JS engine: only Math.imul/floor/abs/min/max, + - * / and bit ops (CLAUDE.md contracts).",
        },
        {
          selector: "BinaryExpression[operator='**'], AssignmentExpression[operator='**=']",
          message: "Worldgen must be bit-identical in every JS engine: no ** (pow is not exactly rounded).",
        },
        { selector: "Identifier[name='Date']", message: "No wall-clock time in seeded code." },
      ],
    },
  },
);
