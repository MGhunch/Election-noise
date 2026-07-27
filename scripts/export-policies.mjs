// Export the Election Noise Policies table from Airtable to data/policies.json.
// One-way: Airtable is the source of truth, this file overwrites the JSON.
// Requires AIRTABLE_TOKEN in the environment (scope: data.records:read on the base).

const BASE = "appJUnm4XV8uuZCqY";
const TABLE = "tblKZQzsDXu9RvpEw";

// Field IDs, not names — renaming a column in Airtable can't break the export.
const F = {
  slug: "fldg1vJZEHx54ZdT8",
  title: "fldWGXmDqWPa03YxU",
  party: "fldRSY7GPMOFd6McF",
  conversation: "fldO5x1If9WJCH7Ie",
  secondary: "fld9CcdbXWyeFrn8J",
  description: "fldT1SZqixoDNuIQv",
  size: "fld31OALg4DwwS9hX",
  immediacy: "fldW37gRISRN1p5I5",
  mechanism: "fldl0cu42E6HvRjeQ",
  econ: "fldqExk4i0f81PGBm",
  econEngaged: "fldYft9twSzJl5qF4",
  direction: "fldrYUl22OaJMrz3o",
  whySize: "fldbkJ9QS2IY8bg3R",
  whyShape: "fldVaQGcVoUGGly2S",
  whyPosition: "fldwiQgX1dzMitRpa",
  confidence: "fldt0Gx0VCrnon3rO",
  confidenceNote: "fldiUUfKcftaGx0IF",
  flags: "fldWjL5nwWnqgzweC",
  status: "fldM1JT4DrgItVVOZ",
  verified: "fldbBWBPjkdUbxC0w",
  source: "fldCHMUQQ1qej0p3Q",
  partyLink: "fldsPiiFoBiak0CLb",
  funds: "fldYRchbc9MG6siFP",
  announced: "fldeP71YUYkn2275V",
};

const token = process.env.AIRTABLE_TOKEN;
if (!token) {
  console.error("AIRTABLE_TOKEN is not set.");
  process.exit(1);
}

async function fetchAll() {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE}/${TABLE}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("returnFieldsByFieldId", "true");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.error(`Airtable ${res.status}: ${await res.text()}`);
      process.exit(1);
    }
    const page = await res.json();
    records.push(...page.records);
    offset = page.offset;
  } while (offset);
  return records;
}

const str = (v) => (typeof v === "string" ? v.trim() : "");
const int = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

function toPolicy(rec) {
  const f = rec.fields;
  const held = !f[F.size]; // held records carry no Size in the base
  return {
    slug: str(f[F.slug]),
    party: str(f[F.party]),
    conversation: str(f[F.conversation]),
    secondary: str(f[F.secondary]),
    title: str(f[F.title]),
    description: str(f[F.description]),
    size: held ? null : str(f[F.size]),
    immediacy: held ? null : int(f[F.immediacy]),
    mechanism: held ? null : int(f[F.mechanism]),
    econ: typeof f[F.econ] === "number" ? f[F.econ] : null,
    econ_engaged: !!f[F.econEngaged],
    direction: typeof f[F.direction] === "number" ? f[F.direction] : null,
    why: {
      size: str(f[F.whySize]),
      shape: str(f[F.whyShape]),
      position: str(f[F.whyPosition]),
    },
    confidence: str(f[F.confidence]),
    confidence_note: str(f[F.confidenceNote]),
    flags: Array.isArray(f[F.flags]) ? [...f[F.flags]].sort() : [],
    status: str(f[F.status]) || "live",
    verified: !!f[F.verified],
    source: str(f[F.source]),
    party_link: str(f[F.partyLink]),
    funds: str(f[F.funds]),
    announced: str(f[F.announced]) || null,
  };
}

const records = await fetchAll();
const policies = records.map(toPolicy).filter((p) => p.slug);

// Guardrails: a bad export should fail loudly, not publish quietly.
const slugs = new Set();
for (const p of policies) {
  if (slugs.has(p.slug)) {
    console.error(`Duplicate slug in Airtable: ${p.slug}`);
    process.exit(1);
  }
  slugs.add(p.slug);
}
if (policies.length < 50) {
  console.error(`Only ${policies.length} records came back — refusing to publish a partial export.`);
  process.exit(1);
}
for (const p of policies) {
  if (p.funds && !slugs.has(p.funds)) {
    console.error(`${p.slug}: Funds points at unknown slug "${p.funds}"`);
    process.exit(1);
  }
}

policies.sort((a, b) => a.slug.localeCompare(b.slug));

const out = {
  updated: new Date().toISOString().slice(0, 10),
  generated_by: "airtable-export",
  note: "Generated from the Election Noise Airtable base — do not hand-edit. Slugs are permanent: never renamed, never reused, never resequenced. Rule: verified = news link in source; unverified = party site.",
  count: policies.length,
  policies,
};

const { writeFileSync } = await import("node:fs");
writeFileSync("data/policies.json", JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote data/policies.json — ${policies.length} records.`);
