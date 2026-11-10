import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";

const input = process.argv[2] ?? "data/ZA.txt";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and the server-only SUPABASE_SERVICE_ROLE_KEY in .env.local.");
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const provinceCode = { "11":"EC", "03":"FS", "06":"GP", "02":"KZN", "09":"LP", "07":"MP", "10":"NW", "08":"NC", "05":"WC" };
const provinceRows = await db.from("provinces").select("id,code");
if (provinceRows.error) throw provinceRows.error;
const provinceIds = new Map((provinceRows.data ?? []).map(p => [p.code, p.id]));
const toPlaceType = code => code === "PPLC" || code === "PPLA" || code === "PPLA2" ? "city" : code === "PPLX" ? "suburb" : code.startsWith("PPL") ? "town" : "other";
let batch = [], read = 0, written = 0, skipped = 0;
async function flush() {
  if (!batch.length) return;
  const { error } = await db.from("places").upsert(batch, { onConflict: "geoname_id" });
  if (error) throw error;
  written += batch.length; batch = [];
  process.stdout.write(`\rRead ${read.toLocaleString()} · imported ${written.toLocaleString()} · skipped ${skipped.toLocaleString()}`);
}
const rl = createInterface({ input: createReadStream(input), crlfDelay: Infinity });
for await (const line of rl) {
  read++;
  const c = line.split("\t");
  if (c.length < 19 || c[8] !== "ZA" || c[6] !== "P") { skipped++; continue; }
  const code = provinceCode[c[10]];
  const provinceId = provinceIds.get(code);
  const geonameId = Number(c[0]), latitude = Number(c[4]), longitude = Number(c[5]);
  if (!provinceId || !Number.isFinite(geonameId) || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !c[1]) { skipped++; continue; }
  batch.push({ geoname_id: geonameId, name: c[1].slice(0,180), province_id: provinceId, place_type: toPlaceType(c[7]), latitude, longitude, location: `SRID=4326;POINT(${longitude} ${latitude})` });
  if (batch.length >= 500) await flush();
}
await flush();
process.stdout.write(`\nCompleted: ${written.toLocaleString()} places imported; ${skipped.toLocaleString()} rows skipped.\n`);
