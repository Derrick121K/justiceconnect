import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const required = [
  "src/app/page.tsx",
  "src/app/actions.ts",
  "src/app/dashboard/page.tsx",
  "src/app/dashboard/opportunities/page.tsx",
  "src/app/professionals/credentials/page.tsx",
  "src/app/admin/page.tsx",
  "src/app/jcstudio/page.tsx",
  "src/app/jcstudio/matters/page.tsx",
  "src/app/jcstudio/matters/new/page.tsx",
  "src/app/jcstudio/matters/[id]/page.tsx",
  "src/app/jcstudio/tasks/page.tsx",
  "src/app/jcstudio/intake/page.tsx",
  "src/app/compliance/page.tsx",
  "src/app/platform-admin/page.tsx",
  "src/components/pwa-register.tsx",
  "public/manifest.webmanifest",
  "public/icons/jcstudio.svg",
  "public/offline.html",
  "public/sw.js",
  "desktop/main.cjs",
  "desktop/preload.cjs",
  "desktop/setup.html",
  "desktop/setup.js",
  "desktop/setup.css",
  "desktop/package.json",
  "docs/CONNECTED_PRODUCT_ARCHITECTURE.md",
  "tests/connected-suite-security.test.ts",
  "supabase/migrations/20261127190000_jcstudio_and_connected_products.sql",
  "src/lib/supabase/server.ts",
  "src/lib/form-data.ts",
  "proxy.ts",
  "supabase/bootstrap_admin.sql",
  "supabase/migrations/20261127122425_firm_workspace_rls_scope_hardening.sql",
  "supabase/migrations/20261127122930_practitioner_eligibility_and_consultation_lock.sql",
  "supabase/migrations/20261127123216_citext_and_postgis_function_privilege_hardening.sql",
  "supabase/migrations/20261127172902_ffc_credential_review_and_expiry_rules.sql",
  "supabase/migrations/20261127173151_south_africa_credential_expiry_timezone.sql",
  "tests/firm-policy-regression.test.ts",
  "tests/practitioner-eligibility-regression.test.ts",
  "tests/ffc-credential-review.test.ts",
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
  "practice_matters",
  "practice_matter_members",
  "practice_matter_notes",
  "practice_tasks",
  "practice_events",
  "practice_time_entries",
  "practice_documents",
  "practice_invoices",
  "practice_invoice_items",
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
  path.join(root, "supabase/migrations/20261127122425_firm_workspace_rls_scope_hardening.sql"),
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

const expiryTimezoneMigration = await readFile(
  path.join(root, "supabase/migrations/20261127173151_south_africa_credential_expiry_timezone.sql"),
  "utf8",
);
if (!expiryTimezoneMigration.includes("Africa/Johannesburg")) {
  failures.push("Credential expiry decisions must use the South African calendar date.");
}

const credentialsPage = await readFile(
  path.join(root, "src/app/professionals/credentials/page.tsx"),
  "utf8",
);
if (!credentialsPage.includes('value="ffc"') || !credentialsPage.includes("currentSouthAfricanDate")) {
  failures.push("Credential form must expose FFC separately and use the South African date for expiry.");
}
const dashboardPage = await readFile(
  path.join(root, "src/app/dashboard/page.tsx"),
  "utf8",
);
if (
  !dashboardPage.includes("Profile review:") ||
  !dashboardPage.includes("Credential submissions") ||
  !dashboardPage.includes("Expired — replacement required")
) {
  failures.push("Dashboard must distinguish profile approval from credential review and show expired documents.");
}

const jcstudioMigration = await readFile(
  path.join(root, "supabase/migrations/20261127190000_jcstudio_and_connected_products.sql"),
  "utf8",
);
for (const invariant of [
  "create_practice_matter",
  "mandate_row.engagement_status <> 'active'",
  "Africa/Johannesburg",
  "studio members read internal notes",
  "studio billing roles read invoices",
  "account.status = 'active'",
  "f.verification_status = 'verified'",
  "enable row level security",
]) {
  if (!jcstudioMigration.includes(invariant)) {
    failures.push(`JCStudio migration is missing security or workflow invariant: ${invariant}`);
  }
}

const serviceWorker = await readFile(path.join(root, "public/sw.js"), "utf8");
if (/cache\.put|cache\.addAll|caches\.match\(request/i.test(serviceWorker)) {
  failures.push("Service worker must not cache authenticated or confidential application responses.");
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
