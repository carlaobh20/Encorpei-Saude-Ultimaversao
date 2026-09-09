import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["playwright-report", "test-results", "dist", "node_modules", "supabase/functions"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // ── React hooks: enforce correct deps ──────────────
      ...reactHooks.configs.recommended.rules,

      // ── React refresh ──────────────────────────────────
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // ── TypeScript: real quality enforcement ───────────
      // Disallow explicit `any` — warn first to allow gradual adoption
      "@typescript-eslint/no-explicit-any": "warn",
      // Flag unused vars but allow _ prefix and destructure rest siblings
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // Prevent empty functions (allow intentional noop with comment)
      "@typescript-eslint/no-empty-function": ["warn", { allow: ["arrowFunctions"] }],
      // Ban @ts-ignore; require @ts-expect-error with description
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": true,
          "ts-expect-error": "allow-with-description",
          "ts-nocheck": true,
        },
      ],
      // Prefer `as const` over literal type assertions
      "@typescript-eslint/prefer-as-const": "warn",
      // No non-null assertions (warn, since many exist)
      "@typescript-eslint/no-non-null-assertion": "warn",

      // ── JavaScript: prevent real bugs ──────────────────
      // No console.log in production code (warn to allow dev usage)
      "no-console": ["warn", { allow: ["warn", "error", "debug", "info"] }],
      // Require === instead of ==
      eqeqeq: ["error", "always", { null: "ignore" }],
      // No var — use let/const
      "no-var": "error",
      // Prefer const when not reassigned
      "prefer-const": "warn",
      // No unreachable code
      "no-unreachable": "error",
      // No duplicate case labels
      "no-duplicate-case": "error",
      // No self-assignment
      "no-self-assign": "error",
      // No empty destructuring
      "no-empty-pattern": "error",
      // No debugger in production
      "no-debugger": "error",
    },
  },
);
