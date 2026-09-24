const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const isWatch = process.argv.includes("--watch");

function entryPointToFunctionKey(entryPoint) {
  const folder = path.basename(path.dirname(entryPoint));
  return folder.replace(/-/g, "_");
}

function entryPointToFolderName(entryPoint) {
  return path.basename(path.dirname(entryPoint));
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
  "src/functions/sales/index.ts",
  "src/functions/process-sequence/index.ts",
  "src/functions/templates/index.ts",
  "src/functions/bulk-send/index.ts",
  "src/functions/process-bulk-send/index.ts",
  "src/functions/campaigns/index.ts",
  "src/functions/process-campaign/index.ts",
  "src/functions/metrics/index.ts",
  "src/functions/reports/index.ts",
  "src/functions/support-tickets/index.ts",
  "src/functions/billing/index.ts",
  "src/functions/whatsapp-connect/index.ts",
  "src/functions/admin/index.ts",
  "src/functions/reseller/index.ts",
  "src/functions/public-api/index.ts",
  "src/functions/api-keys/index.ts",
  "src/functions/integrations/index.ts",
  "src/functions/process-integration/index.ts",
  "src/functions/automations/index.ts",
  "src/functions/process-automation/index.ts",
  "src/functions/knowledge/index.ts",
  "src/functions/macros/index.ts",
  "src/functions/process-knowledge/index.ts",
  "src/functions/meta-flows/index.ts",
  "src/functions/flows/index.ts",
  "src/functions/flow-hooks/index.ts",
  "src/functions/process-flow/index.ts",
  "src/functions/process-flow-event/index.ts",
  "src/functions/process-call/index.ts",
  "src/functions/calling/index.ts",
  "src/functions/instagram-connect/index.ts",
  "src/functions/telegram-connect/index.ts",
  "src/functions/telegram-webhook/index.ts",
  "src/functions/messenger-connect/index.ts",
  "src/functions/sms-webhook/index.ts",
  "src/functions/email-inbound/index.ts",
  "src/functions/email-imap-connect/index.ts",
  "src/functions/poll-imap-inbound/index.ts",
  "src/functions/webchat/index.ts",
  "src/functions/voicebot/index.ts",
  "src/functions/voicebot-session/index.ts",
  "src/functions/telephony/index.ts",
  "src/functions/process-telephony-cdr/index.ts",
  "src/functions/realtime/index.ts",
  "src/functions/realtime-ws/index.ts",
  "src/functions/calendar/index.ts",
  "src/functions/public-calendar/index.ts",
  "src/functions/hosted-forms/index.ts",
  "src/functions/short-links/index.ts",
  "src/functions/payments/index.ts",
  "src/functions/catalog/index.ts",
  "src/functions/cognito-pre-signup/index.ts",
  "src/functions/mailrelay/index.ts",
  "src/functions/process-mailrelay-sync/index.ts",
  "src/functions/process-whatsapp-sync/index.ts",
  "src/functions/mailrelay-webhook/index.ts",
  "src/functions/google-business/index.ts",
];

const isProduction = process.env.NODE_ENV === "production";

function resolveBuildScope() {
  if (isWatch || process.env.LAMBDA_BUILD_ALL === "true") {
    return { buildAll: true, functionKeys: null };
  }

  const rawFunctions = process.env.LAMBDA_BUILD_FUNCTIONS || "";
  const functionKeys = rawFunctions
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (functionKeys.length === 0) {
    return { buildAll: true, functionKeys: null };
  }

  const knownKeys = new Set(entryPoints.map(entryPointToFunctionKey));
  const unknownKeys = functionKeys.filter((key) => !knownKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`Unknown Lambda function key(s): ${unknownKeys.join(", ")}`);
  }

  return { buildAll: false, functionKeys: new Set(functionKeys) };
}

function selectEntryPoints(scope) {
  if (scope.buildAll) {
    return entryPoints;
  }

  return entryPoints.filter((entryPoint) =>
    scope.functionKeys.has(entryPointToFunctionKey(entryPoint))
  );
}

function zipPathForFunction(distDir, functionKey) {
  return path.join(distDir, "zips", `${functionKey}.zip`);
}

function findMissingCachedPackages(distDir, scope) {
  if (scope.buildAll) {
    return [];
  }

  const missing = [];
  for (const entryPoint of entryPoints) {
    const functionKey = entryPointToFunctionKey(entryPoint);
    if (scope.functionKeys.has(functionKey)) {
      continue;
    }
    if (!fs.existsSync(zipPathForFunction(distDir, functionKey))) {
      missing.push(functionKey);
    }
  }
  return missing;
}

function createBuildOptions(selectedEntryPoints) {
  return {
    entryPoints: selectedEntryPoints,
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outdir: "dist",
    outbase: "src/functions",
    sourcemap: !isProduction,
    minify: isProduction,
    external: [
      "@aws-sdk/*",
    ],
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
    },
  };
}

function copyEmailAssets(distDir) {
  const emailAssetsSrc = path.join(__dirname, "../src/lib/email/assets");
  const emailAssetsDestDir = path.join(distDir, "email/assets");
  fs.mkdirSync(emailAssetsDestDir, { recursive: true });
  for (const entry of fs.readdirSync(emailAssetsSrc, { withFileTypes: true })) {
    const sourcePath = path.join(emailAssetsSrc, entry.name);
    const destPath = path.join(emailAssetsDestDir, entry.name);
    if (entry.isDirectory()) {
      fs.cpSync(sourcePath, destPath, { recursive: true });
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

function createFunctionPackages(distDir, entryPointsToPackage) {
  const zipsDir = path.join(distDir, "zips");
  const stagingRoot = path.join(distDir, ".zip-staging");
  fs.mkdirSync(zipsDir, { recursive: true });
  fs.rmSync(stagingRoot, { recursive: true, force: true });

  const packages = {};

  for (const entryPoint of entryPoints) {
    const functionKey = entryPointToFunctionKey(entryPoint);
    packages[functionKey] = `zips/${functionKey}.zip`;
  }

  for (const entryPoint of entryPointsToPackage) {
    const functionKey = entryPointToFunctionKey(entryPoint);
    const folderName = entryPointToFolderName(entryPoint);
    const functionDir = path.join(distDir, folderName);
    const stagingDir = path.join(stagingRoot, functionKey);
    const zipPath = zipPathForFunction(distDir, functionKey);

    if (!fs.existsSync(functionDir)) {
      throw new Error(`Build output not found for ${functionKey}: ${functionDir}`);
    }

    fs.mkdirSync(stagingDir, { recursive: true });
    fs.cpSync(functionDir, path.join(stagingDir, folderName), { recursive: true });
    fs.cpSync(path.join(distDir, "email"), path.join(stagingDir, "email"), { recursive: true });

    execSync(`cd ${stagingDir} && zip -qr ${zipPath} . -x '*.map'`, { stdio: "inherit" });
  }

  fs.rmSync(stagingRoot, { recursive: true, force: true });

  const missingPackages = entryPoints
    .map(entryPointToFunctionKey)
    .filter((functionKey) => !fs.existsSync(zipPathForFunction(distDir, functionKey)));

  if (missingPackages.length > 0) {
    throw new Error(`Missing Lambda package(s): ${missingPackages.join(", ")}`);
  }

  return packages;
}

async function build() {
  try {
    const distDir = path.resolve(__dirname, "../dist");
    let scope = resolveBuildScope();
    let selectedEntryPoints = selectEntryPoints(scope);

    if (!isWatch) {
      const missingCachedPackages = findMissingCachedPackages(distDir, scope);
      if (missingCachedPackages.length > 0) {
        console.log(
          `Missing cached package(s) for ${missingCachedPackages.join(", ")}. Falling back to full build.`
        );
        scope = { buildAll: true, functionKeys: null };
        selectedEntryPoints = entryPoints;
      }
    }

    if (!isWatch && scope.buildAll && fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }

    fs.mkdirSync(distDir, { recursive: true });

    if (isWatch) {
      const ctx = await esbuild.context(createBuildOptions(entryPoints));
      await ctx.watch();
      console.log("Watching for changes...");
      return;
    }

    if (scope.buildAll) {
      console.log(`Building all ${selectedEntryPoints.length} Lambda function(s)...`);
    } else {
      console.log(
        `Incremental build for ${selectedEntryPoints.length} Lambda function(s): ${[...scope.functionKeys].join(", ")}`
      );
    }

    await esbuild.build(createBuildOptions(selectedEntryPoints));
    console.log("esbuild complete.");

    copyEmailAssets(distDir);
    const packages = createFunctionPackages(distDir, selectedEntryPoints);

    const manifest = {
      functions: entryPoints.map(entryPointToFunctionKey).sort(),
      packages,
    };
    fs.writeFileSync(
      path.join(distDir, "lambda-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`
    );
    console.log(`Packaged ${selectedEntryPoints.length} function(s); manifest has ${manifest.functions.length} total.`);
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();
