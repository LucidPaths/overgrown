import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["**/dist/", "**/node_modules/", "client/public/generated/"]),
  js.configs.recommended,
  tseslint.configs.recommended,
);
