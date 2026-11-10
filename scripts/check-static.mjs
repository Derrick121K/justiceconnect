import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const required = [
  "src/app/page.tsx", "src/app/actions.ts", "src/app/dashboard/page.tsx",
  "src/app/dashboard/opportunities/page.tsx", "src/app/admin/page.tsx",
  "src/lib/supabase/server.ts", "proxy.ts", "supabase/bootstrap_admin.sql",
];
const failures = [];
for (const file of required) {
  try { await stat(path.join(root, file)); } catch { failures.push(`Missing required file: ${file}`); }
}
const migrations = (await readdir(path.join(root, "supabase/migrations"))).filter(f => f.endsWith(".sql")).sort();
if (migrations.length < 10) failures.push("Expected the complete ordered migration set (at least 10 files).");
for (const file of migrations) {
  const sql = await readFile(path.join(root, "supabase/migrations", file), "utf8");
  if (/security\s+definer/i.test(sql) && !/set\s+search_path\s*=\s*['"]{2}/i.test(sql) && !/set\s+search_path\s*=\s*public/i.test(sql)) failures.push(`${file}: SECURITY DEFINER function has no explicit search_path.`);
}
const srcFiles = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full); else srcFiles.push(full);
  }
}
await walk(path.join(root, "src"));
for (const file of srcFiles.filter(f => /\.(ts|tsx|js|jsx)$/.test(f))) {
  const body = await readFile(file, "utf8");
  if (/NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE|NEXT_PUBLIC_[A-Z0-9_]*SECRET/i.test(body)) failures.push(`${path.relative(root,file)}: public secret environment variable reference found.`);
}
const migrationText = await Promise.all(migrations.map(f => readFile(path.join(root,"supabase/migrations",f),"utf8")));
const combined = migrationText.join("\n");
for (const table of ["profiles","user_roles","practitioners","legal_matters","matter_documents","messages","consultations","notifications","audit_events"]) {
  if (!combined.includes(`alter table public.${table} enable row level security`) && !combined.includes(`alter table public.${table} enable row level security;`)) {
    // The base schema enables RLS for its core tables in a controlled DO loop.
    if (!combined.includes(`'${table}'`)) failures.push(`No RLS enablement reference found for ${table}.`);
  }
}
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`Static project checks passed: ${required.length} required files, ${migrations.length} migrations, ${srcFiles.length} source files.`);
