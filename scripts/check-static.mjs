import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const required = [
  "src/app/page.tsx",
  "src/app/actions.ts",
  "src/app/dashboard/page.tsx",
  "src/app/dashboard/opportunities/page.tsx",
  "src/app/admin/page.tsx",
  "src/lib/supabase/server.ts",
  "src/lib/form-data.ts",
  "proxy.ts",
  "supabase/bootstrap_admin.sql",
  "supabase/patches/firm_workspace_rls_scope_hardening.sql",
  "supabase/verification/firm_workspace_rls_policy_check.sql",
];
const failures = [];

for (const file of required) {
  try {
    await stat(path.join(root, file));
  } catch {
    failures.push(`Missing required file: ${file}`);
  }
}

const migrations = (await readdir(path.join(root, "supabase/migrations")))
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (migrations.length < 10) {
  failures.push("Expected the complete ordered migration set (at least 10 files).");
}

const migrationText = await Promise.all(
  migrations.map((file) => readFile(path.join(root, "supabase/migrations", file), "utf8")),
);
for (let index = 0; index < migrations.length; index += 1) {
  const sql = migrationText[index];
  if (/security\s+definer/i.test(sql) && !/set\s+search_path\s*=\s*['"]{2}/i.test(sql)) {
    failures.push(`${migrations[index]}: SECURITY DEFINER functions must use an empty search_path.`);
  }
}

const srcFiles = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
    } else {
      srcFiles.push(fullPath);
    }
  }
}

await walk(path.join(root, "src"));
for (const file of srcFiles.filter((item) => /\.(ts|tsx|js|jsx)$/.test(item))) {
  const body = await readFile(file, "utf8");
  if (/NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE|NEXT_PUBLIC_[A-Z0-9_]*SECRET/i.test(body)) {
    failures.push(`${path.relative(root, file)}: public secret environment variable reference found.`);
  }
}

const combinedMigrations = migrationText.join("\n");
for (const table of [
  "profiles",
  "user_roles",
  "practitioners",
  "legal_matters",
  "matter_documents",
  "messages",
  "consultations",
  "notifications",
  "audit_events",
]) {
  const explicitlyEnabled = new RegExp(
    `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
    "i",
  ).test(combinedMigrations);
  const includedInRlsLoop = combinedMigrations.includes(`'${table}'`);
  if (!explicitlyEnabled && !includedInRlsLoop) {
    failures.push(`No RLS enablement reference found for public.${table}.`);
  }
}

const firmPolicyPatch = await readFile(
  path.join(root, "supabase/patches/firm_workspace_rls_scope_hardening.sql"),
  "utf8",
);
for (const expected of [
  "fm.firm_id = law_firms.id",
  "fm.firm_id = firm_branches.firm_id",
  "fm.user_id = (select auth.uid())",
  "to authenticated",
]) {
  if (!firmPolicyPatch.toLowerCase().includes(expected)) {
    failures.push(`Firm RLS hardening patch is missing required tenant scope: ${expected}`);
  }
}
for (const unsafePredicate of [
  /fm\\.firm_id\\s*=\\s*fm\\.firm_id/i,
  /fm\\.firm_id\\s*=\\s*firm_id\\b/i,
  /fm\\.firm_id\\s*=\\s*id\\b/i,
]) {
  if (unsafePredicate.test(firmPolicyPatch)) {
    failures.push("Firm RLS hardening patch contains an unscoped membership predicate.");
  }
}

const firmPolicyVerification = await readFile(
  path.join(root, "supabase/verification/firm_workspace_rls_policy_check.sql"),
  "utf8",
);
if (!firmPolicyVerification.includes("pg_catalog.pg_policies")) {
  failures.push("Missing live catalog verification for firm workspace RLS policies.");
}

const actionsFile = await readFile(path.join(root, "src/app/actions.ts"), "utf8");
if (/encodeURIComponent\([^)]*error\??\.message/i.test(actionsFile)) {
  failures.push("Server actions must not return raw Supabase/Auth error messages to clients.");
}

const workflowsDirectory = path.join(root, ".github/workflows");
let workflowFiles = [];
try {
  workflowFiles = (await readdir(workflowsDirectory)).filter((file) => /\.ya?ml$/i.test(file));
} catch {
  failures.push("Missing .github/workflows directory.");
}

if (workflowFiles.length < 2) {
  failures.push("Expected CI and CodeQL workflow definitions.");
}

for (const file of workflowFiles) {
  const workflow = await readFile(path.join(workflowsDirectory, file), "utf8");
  if (!/^permissions:/m.test(workflow)) {
    failures.push(`${file}: workflow must declare least-privilege permissions.`);
  }
  const unpinnedActions = workflow.match(/^\s*uses:\s*[^\s@]+@(?![a-f0-9]{40}\b)[^\s]+/gim) ?? [];
  if (unpinnedActions.length > 0) {
    failures.push(`${file}: GitHub Actions must be pinned to full commit SHAs (${unpinnedActions.join(", ")}).`);
  }
  if (/actions\/checkout@/i.test(workflow) && !/persist-credentials:\s*false/i.test(workflow)) {
    failures.push(`${file}: checkout must disable persisted Git credentials.`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `Static project checks passed: ${required.length} required files, ${migrations.length} migrations, ${srcFiles.length} source files, ${workflowFiles.length} workflows.`,
);
