import tseslint from "typescript-eslint";

export default tseslint.config(...tseslint.configs.recommended, {
  files: ["services/*/src/**/*.ts"],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
});
