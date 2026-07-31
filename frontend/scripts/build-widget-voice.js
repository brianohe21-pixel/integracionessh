const esbuild = require("esbuild");
const path = require("path");

async function build() {
  await esbuild.build({
    entryPoints: [path.join(__dirname, "../public/widget-voice.entry.ts")],
    bundle: true,
    format: "iife",
    globalName: "VoicebotWidgetBundle",
    outfile: path.join(__dirname, "../public/widget-voice.bundle.js"),
    platform: "browser",
    target: "es2020",
    minify: process.env.NODE_ENV === "production",
  });
  console.log("widget-voice.bundle.js built");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
