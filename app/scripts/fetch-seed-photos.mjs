/**
 * Fetch seed portraits from Pexels into public/seed/.
 *
 * Pexels licence: free for commercial use, no attribution required.
 * These are placeholder demo profiles — real users upload their own photos.
 *
 *   node scripts/fetch-seed-photos.mjs
 */

import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("public/seed");
fs.mkdirSync(OUT, { recursive: true });

const WOMEN = [
  29125196, 37627047, 7685497, 34719524, 33566401, 6594747, 35704995, 19011883,
  19576823, 30066779, 8749763, 29665809, 8720868, 17040951, 18557359, 33078836,
  19115355, 7176438,
];

const MEN = [
  13141398, 12547364, 4889473, 11740473, 1996930, 899357, 29585150, 7288892,
  13006909, 7828203, 12366973, 6200777, 7261970, 15209910, 7251805, 4791743,
  7089664, 38178591,
];

const url = (id) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=900&h=1200&fit=crop`;

async function grab(id, file) {
  const res = await fetch(url(id));
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const type = res.headers.get("content-type") ?? "";
  const buf = Buffer.from(await res.arrayBuffer());
  if (!type.includes("image")) return { ok: false, reason: type };
  if (buf.length < 12_000) return { ok: false, reason: `only ${buf.length}b` };
  fs.writeFileSync(path.join(OUT, file), buf);
  return { ok: true, size: buf.length };
}

const results = [];

for (const [gender, ids] of [["w", WOMEN], ["m", MEN]]) {
  for (let i = 0; i < ids.length; i++) {
    const file = `${gender}${String(i + 1).padStart(2, "0")}.jpg`;
    try {
      const r = await grab(ids[i], file);
      results.push({ file, id: ids[i], ...r });
      console.log(r.ok ? `ok   ${file}  ${Math.round(r.size / 1024)}kb` : `FAIL ${file} ${r.reason}`);
    } catch (err) {
      results.push({ file, id: ids[i], ok: false, reason: err.message });
      console.log(`FAIL ${file} ${err.message}`);
    }
  }
}

const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} downloaded`);

// Contact sheet for visual review.
const cells = results
  .map(
    (r) => `<figure><img src="/seed/${r.file}" alt="" /><figcaption>${r.file}${
      r.ok ? "" : " ✗"
    }</figcaption></figure>`,
  )
  .join("\n");

fs.writeFileSync(
  path.resolve("public/seed/contact-sheet.html"),
  `<!doctype html><meta charset="utf-8"><style>
   body{background:#111;color:#eee;font:12px system-ui;margin:0;padding:12px}
   .grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
   figure{margin:0}
   img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:6px;display:block}
   figcaption{font-size:10px;color:#888;margin-top:3px;text-align:center}
  </style><div class="grid">${cells}</div>`,
);
console.log("contact sheet: public/seed/contact-sheet.html");
