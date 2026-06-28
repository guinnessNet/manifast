import mri from "mri";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import open from "open";
import { createServer } from "../server/index";
import { runInit } from "./init";
import { validateWorkspace } from "./validate";
import pkg from "../../package.json";

const here = path.dirname(fileURLToPath(import.meta.url));
// dist/cli/index.js → ../../ = package root (skill/, dist/web). Same layout in
// dev (src/cli/index.ts → repo root).
const packageRoot = path.resolve(here, "../..");
const skillDir = path.join(packageRoot, "skill");
const webDir = path.resolve(here, "../web"); // dist/web in a built package

const HELP = `
  manifast — local visualizer for AI-authored .manifast/ workspaces

  Usage:
    manifast [dir]          start the server for <dir> (or cwd) and open browser
    manifast init [dir]     scaffold .manifast/ and install the agent skill
    manifast validate [dir] check the workspace against the schemas (exit 1 on errors)
    manifast --help         show this help

  Options:
    -p, --port <n>          port (default 4317; next free port if taken)
        --no-open           do not open the browser
        --strict            (validate) treat warnings as failures too
    -h, --help              show help
    -v, --version           print version

  Docs live in .manifast/. The app is read-only — agents author the files.
`;

function resolveWorkspace(input?: string): { projectDir: string; manifastDir: string } {
  const base = path.resolve(input ?? process.cwd());
  if (path.basename(base) === ".manifast") {
    return { projectDir: path.dirname(base), manifastDir: base };
  }
  return { projectDir: base, manifastDir: path.join(base, ".manifast") };
}

async function cmdInit(input?: string): Promise<void> {
  const { projectDir, manifastDir } = resolveWorkspace(input);
  console.log(`\n  Initializing manifast in ${projectDir}\n`);
  const report = await runInit(projectDir, manifastDir, skillDir);

  for (const c of report.created) console.log(`  + ${c}`);
  for (const u of report.updated) console.log(`  ~ ${u}`);
  for (const s of report.skipped) console.log(`  · skip (exists): ${s}`);
  if (report.created.length === 0 && report.updated.length === 0)
    console.log("  (nothing new — everything already present)");

  console.log(`\n  Done. Next:`);
  console.log(`    1. Ask Claude Code / Codex to design wireframes & docs (it will read the skill).`);
  console.log(`    2. Run \`npx manifast\` to view them live.\n`);
}

async function cmdValidate(input: string | undefined, strict: boolean): Promise<void> {
  const { projectDir, manifastDir } = resolveWorkspace(input);
  if (!existsSync(manifastDir)) {
    console.error(`\n  ⚠ No .manifast/ found at ${manifastDir}\n`);
    process.exitCode = 1;
    return;
  }

  const report = await validateWorkspace(manifastDir, projectDir);
  const errors = report.issues.filter((i) => i.level === "error");
  const warnings = report.issues.filter((i) => i.level === "warning");
  const c = report.counts;

  console.log(`\n  Validating ${manifastDir}`);
  console.log(
    `  (${c.wireframes} wireframes · ${c.docs} docs · ${c.tasks} tasks · ${c.diagrams} diagrams · ${c.phases} phases)\n`,
  );

  if (errors.length) {
    console.log(`  ✖ ${errors.length} error${errors.length > 1 ? "s" : ""}`);
    for (const e of errors) console.log(`    ${e.path}\n      ${e.message}`);
    console.log("");
  }
  if (warnings.length) {
    console.log(`  ⚠ ${warnings.length} warning${warnings.length > 1 ? "s" : ""}`);
    for (const w of warnings) console.log(`    ${w.path}\n      ${w.message}`);
    console.log("");
  }

  const fail = errors.length > 0 || (strict && warnings.length > 0);
  if (fail) {
    console.log(`  FAIL — ${errors.length} error(s), ${warnings.length} warning(s)\n`);
    process.exitCode = 1;
  } else if (warnings.length) {
    console.log(`  OK with ${warnings.length} warning(s) (use --strict to fail on warnings)\n`);
  } else {
    console.log(`  ✓ valid — no issues\n`);
  }
}

async function cmdStart(input: string | undefined, port: number, doOpen: boolean): Promise<void> {
  const { projectDir, manifastDir } = resolveWorkspace(input);

  if (!existsSync(manifastDir)) {
    console.warn(`\n  ⚠ No .manifast/ found at ${manifastDir}`);
    console.warn(`    Run \`manifast init\` here first, then re-run \`manifast\`.\n`);
  }

  const server = await createServer({
    manifastDir,
    projectDir,
    port,
    serveStatic: true,
    webDir,
  });

  console.log(`\n  manifast running → ${server.url}`);
  console.log(`  workspace: ${manifastDir}`);
  console.log(`  (press Ctrl+C to stop)\n`);

  if (doOpen) {
    try {
      await open(server.url);
    } catch {
      console.log(`  Open ${server.url} in your browser.`);
    }
  }

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) process.exit(0); // second Ctrl+C → exit immediately
    shuttingDown = true;
    // Safety net: if a graceful close stalls (e.g. a lingering connection),
    // force-exit so Ctrl+C is never a no-op.
    const force = setTimeout(() => process.exit(0), 2000);
    force.unref();
    try {
      await server.close();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function main(): Promise<void> {
  const argv = mri(process.argv.slice(2), {
    boolean: ["open", "help", "version", "strict"],
    alias: { h: "help", v: "version", p: "port" },
    default: { open: true },
  });

  if (argv.version) {
    console.log((pkg as { version: string }).version);
    return;
  }
  if (argv.help) {
    console.log(HELP);
    return;
  }

  const port = argv.port ? Number(argv.port) : 4317;
  const [cmd, ...rest] = argv._;

  if (cmd === "init") {
    await cmdInit(rest[0]);
    return;
  }

  if (cmd === "validate") {
    await cmdValidate(rest[0], Boolean(argv.strict));
    return;
  }

  // `manifast` (cwd) or `manifast <dir>`
  await cmdStart(cmd, Number.isFinite(port) ? port : 4317, argv.open);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
