const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const isWatch = process.argv.includes("--watch");

function entryPointToFunctionKey(entryPoint) {
  const folder = path.basename(path.dirname(entryPoint));
  return folder.replace(/-/g, "_");
}

const entryPoints = [
  "src/functions/webhook/index.ts",
  "src/functions/process-message/index.ts",
  "src/functions/tenants/index.ts",
  "src/functions/bots/index.ts",
  "src/functions/conversations/index.ts",
  "src/functions/advisors/index.ts",
  "src/functions/contacts/index.ts",
  "src/functions/leads/index.ts",
  "src/functions/templates/index.ts",
  "src/functions/bulk-send/index.ts",
  "src/functions/process-bulk-send/index.ts",
  "src/functions/campaigns/index.ts",
  "src/functions/process-campaign/index.ts",
  "src/functions/metrics/index.ts",
  "src/functions/support-tickets/index.ts",
  "src/functions/billing/index.ts",
  "src/functions/whatsapp-connect/index.ts",
  "src/functions/admin/index.ts",
  "src/functions/public-api/index.ts",
  "src/functions/api-keys/index.ts",
  "src/functions/integrations/index.ts",
  "src/functions/process-integration/index.ts",
  "src/functions/automations/index.ts",
  "src/functions/process-automation/index.ts",
  "src/functions/knowledge/index.ts",
  "src/functions/process-knowledge/index.ts",
  "src/functions/meta-flows/index.ts",
  "src/functions/flows/index.ts",
  "src/functions/process-flow/index.ts",
  "src/functions/process-call/index.ts",
  "src/functions/calling/index.ts",
  "src/functions/instagram-connect/index.ts",
  "src/functions/webchat/index.ts",
  "src/functions/realtime/index.ts",
  "src/functions/calendar/index.ts",
  "src/functions/public-calendar/index.ts",
  "src/functions/payments/index.ts",
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
    const distDir = path.resolve(__dirname, "../dist");
    if (!isWatch && fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }

    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log("Watching for changes...");
    } else {
      await esbuild.build(buildOptions);
      console.log("Build complete.");

      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }
      execSync(`cd ${distDir} && zip -r functions.zip .`, { stdio: "inherit" });
      console.log("Zip created at dist/functions.zip");

      const manifest = {
        functions: entryPoints.map(entryPointToFunctionKey).sort(),
      };
      fs.writeFileSync(
        path.join(distDir, "lambda-manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`
      );
      console.log("Manifest created at dist/lambda-manifest.json");
    }
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();
