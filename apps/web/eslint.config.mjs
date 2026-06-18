import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import hooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [".next/**", "node_modules/**", "storybook-static/**"]
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        URL: "readonly",
        console: "readonly",
        process: "readonly"
      }
    }
  },
  {
    plugins: {
      boundaries,
      "react-hooks": hooks
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "allow",
          rules: [
            {
              disallow: ["api", "services", "state"],
              from: ["components"]
            }
          ]
        }
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^\\.{1,2}/",
              message: "Use the @/... alias for local imports inside apps/web."
            }
          ]
        }
      ],
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error"
    },
    settings: {
      "boundaries/elements": [
        {
          mode: "folder",
          pattern: "src/features/*/components",
          type: "components"
        },
        {
          mode: "folder",
          pattern: "src/features/*/api",
          type: "api"
        },
        {
          mode: "folder",
          pattern: "src/features/*/services",
          type: "services"
        },
        {
          mode: "folder",
          pattern: "src/features/*/state",
          type: "state"
        }
      ]
    }
  }
);
