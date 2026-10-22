import path from "node:path";

function eslintFor(packageDir) {
  return (files) => {
    const cwd = path.resolve(packageDir);
    const args = files
      .map((file) => path.relative(cwd, file))
      .map((file) => JSON.stringify(file))
      .join(" ");
    return `pnpm --dir ${packageDir} exec eslint --cache --fix ${args}`;
  };
}

export default {
  "frontend/**/*.{js,jsx,mjs,cjs,ts,tsx}": eslintFor("frontend"),
  "backend/**/*.{js,cjs,mjs,ts}": eslintFor("backend"),
};
