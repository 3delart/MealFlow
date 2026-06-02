// Flat ESLint config for MealFlow (vanilla browser scripts sharing globals).
module.exports = [
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        // Browser
        window: "readonly", document: "readonly", localStorage: "readonly",
        sessionStorage: "readonly", fetch: "readonly", console: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly", alert: "readonly",
        confirm: "readonly", prompt: "readonly", location: "readonly",
        requestAnimationFrame: "readonly", CustomEvent: "readonly",
        Chart: "readonly", Html5Qrcode: "readonly", google: "readonly",
        module: "writable", navigator: "readonly", FormData: "readonly"
      }
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: {
      // Cross-file globals make no-undef impractical here; rely on these instead.
      "no-undef": "off",
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
      "no-redeclare": "warn",
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-unreachable": "warn",
      "no-constant-condition": ["warn", { checkLoops: false }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "valid-typeof": "error"
    }
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { module: "writable", require: "readonly" }
    }
  }
];
