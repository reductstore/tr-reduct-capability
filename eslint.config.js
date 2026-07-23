const js = require("@eslint/js");

const nodeGlobals = {
  require: "readonly",
  module: "writable",
  process: "readonly",
  __dirname: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  fetch: "readonly",
};

module.exports = [
  { ignores: ["**/node_modules/**", "**/dist/**", "**/*.tgz", "subScript"] },
  js.configs.recommended,
  {
    files: ["*.js", "robot/**/*.js", "cloud/**/*.js", "test/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: nodeGlobals,
    },
  },
  {
    files: ["web/**/*.js", "web/**/*.jsx"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        TR_PKG_NAME: "readonly",
        TR_PKG_VERSION: "readonly",
        TR_PKG_VERSION_NS: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { varsIgnorePattern: "^React$" }],
    },
  },
];
