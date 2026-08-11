/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "js"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^sanitize-html$": "<rootDir>/src/test/mocks/sanitize-html.ts",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(sanitize-html|htmlparser2|dom-serializer|domhandler|domutils|entities)/)",
  ],
  forceExit: true,
};
