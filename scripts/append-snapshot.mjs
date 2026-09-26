/**
 * Append one day's record to data/history.json.
 *
 * Rules that matter:
 *  - one record per calendar day, and a second run on the same day replaces the
 *    first rather than adding a duplicate, so a manual re-run is always safe;
 *  - a record with no liquidity is refused, because that means the upstream API
 *    answered but returned nothing, and a zero in the history is worse than a
 *    missing day: it draws a cliff on a chart that never happened;
 *  - the file stays sorted by date so readers never have to.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const src = process.argv[2];
if (!src) throw new Error("usage: append-snapshot.mjs <record.json>");

const record = JSON.parse(readFileSync(src, "utf8"));
if (!record?.date || !Number.isFinite(record.liquidity) || record.liquidity <= 0) {
  console.error("Refusing to store an empty record:", JSON.stringify(record).slice(0, 200));
  process.exit(1);
}

const path = "data/history.json";
const history = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : [];

const without = history.filter((r) => r.date !== record.date);
if (without.length !== history.length) console.log(`Replacing existing record for ${record.date}`);

const next = [...without, record].sort((a, b) => a.date.localeCompare(b.date));
writeFileSync(path, JSON.stringify(next, null, 0) + "\n");
console.log(`Stored ${record.date}. History now holds ${next.length} day(s).`);
