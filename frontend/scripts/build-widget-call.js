const esbuild = require("esbuild");
const path = require("path");

async function build() {
  await esbuild.build({
    entryPoints: [path.join(__dirname, "../public/widget-call.entry.ts")],
    bundle: true,
    format: "iife",
    globalName: "WebchatCallBundle",
    outfile: path.join(__dirname, "../public/widget-call.bundle.js"),
    platform: "browser",
    target: "es2020",
    minify: process.env.NODE_ENV === "production",
  });
  console.log("widget-call.bundle.js built");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
