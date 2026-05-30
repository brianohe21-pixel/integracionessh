const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const isWatch = process.argv.includes("--watch");

const entryPoints = [
  "src/functions/webhook/index.ts",
  "src/functions/process-message/index.ts",
  "src/functions/tenants/index.ts",
  "src/functions/bots/index.ts",
  "src/functions/conversations/index.ts",
  "src/functions/templates/index.ts",
  "src/functions/bulk-send/index.ts",
  "src/functions/process-bulk-send/index.ts",
  "src/functions/campaigns/index.ts",
  "src/functions/process-campaign/index.ts",
  "src/functions/authorizer/index.ts",
  "src/functions/metrics/index.ts",
  "src/functions/support-tickets/index.ts",
  "src/functions/whatsapp-connect/index.ts",
];

const buildOptions = {
  entryPoints,
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outdir: "dist",
  sourcemap: true,
  minify: process.env.NODE_ENV === "production",
  external: [
    "@aws-sdk/*",
  ],
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
  },
};

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log("Watching for changes...");
    } else {
      await esbuild.build(buildOptions);
      console.log("Build complete.");

      const distDir = path.resolve(__dirname, "../dist");
      execSync(`cd ${distDir} && zip -r functions.zip .`, { stdio: "inherit" });
      console.log("Zip created at dist/functions.zip");
    }
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();
