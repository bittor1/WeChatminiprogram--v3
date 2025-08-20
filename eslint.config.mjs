// eslint.config.mjs
import pluginImport from "eslint-plugin-import";
import wxml from "eslint-plugin-wxml";
import wxmlParser from "@wxml/parser";
import globals from "globals";

export default [
  // JS / TS
  {
    files: ["**/*.js", "**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,     // 含 console、setTimeout…
        ...globals.commonjs,    // 含 module、require…
        wx: "readonly",
        App: "readonly",
        Page: "readonly",
        Component: "readonly",
        Behavior: "readonly",
        getApp: "readonly",
        getCurrentPages: "readonly"
      }
    },
    plugins: { import: pluginImport },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
      "import/order": "warn"
    }
  },

  // WXML
  {
    files: ["**/*.wxml"],
    languageOptions: { parser: wxmlParser },
    plugins: { wxml },
    rules: {
      "wxml/report-wxml-syntax-error": "error",
      "wxml/report-interpolation-error": "error",
      "wxml/no-duplicate-attributes": "error",
      "wxml/wx-key": "warn",
      "wxml/no-const-and-let-in-wxs": "error"
    }
  },

  // 忽略
  { ignores: ["node_modules/**", "dist/**", "build/**", "miniprogram_npm/**"] }
];
