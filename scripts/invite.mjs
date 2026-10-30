#!/usr/bin/env node
// pnpm invite --role reviewer --label "Prajwal" [--count 1] [--district Koppal]
// pnpm invite --role teacher --uses 15 --label "Talakal 29 Oct" [--expires-hours 48]
// Creates FIELD invite links (is_sample false) with the service role, for people who must not be
// Sample: the founder and father as reviewers, real masters, field teachers. A link is a bearer
// credential (D37), so links are written only to field-private/invites.txt (git ignored, chmod 600)
// and never printed. Demo and Sample links are made in the app at /r/invites instead.
// --uses makes ONE group QR (D80): each phone that scans it gets its own anonymous teacher link,
// up to that many people, until it expires. Its QR is saved as a PNG in field-private/ for the
// founder to send to the headmaster; reviewers can also show it at /r/invites/qr/<code>.
import { appendFileSync, chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { correction, generate } from "lean-qr";
import { toPngBuffer } from "lean-qr/extras/node_export";

const { values } = parseArgs({
  options: {
    role: { type: "string", default: "teacher" },
    label: { type: "string" },
    count: { type: "string", default: "1" },
    district: { type: "string", default: "Koppal" },
    uses: { type: "string" },
    "expires-hours": { type: "string", default: "48" },
  },
});

const ROLES = ["teacher", "master", "reviewer", "officer"];
if (!ROLES.includes(values.role)) {
  console.error(`  ✗ --role must be one of ${ROLES.join(", ")}`);
  process.exit(1);
}
const group = values.uses !== undefined;
if (group && values.role !== "teacher") {
  console.error(
    "  ✗ --uses makes a group QR for teachers only (masters and reviewers get their own link)",
  );
  process.exit(1);
}
const uses = Math.min(200, Math.max(1, Math.floor(Number(values.uses)) || 0));
if (group && !uses) {
  console.error("  ✗ --uses must be a number from 1 to 200");
  process.exit(1);
}
const hours = Math.min(720, Math.max(1, Number(values["expires-hours"]) || 48));
const count = group ? 1 : Math.min(50, Math.max(1, Number(values.count) || 1));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("  ✗ Supabase keys missing (run the keys script in your Terminal)");
  process.exit(1);
}

// Unambiguous alphabet (no 0 O 1 I L), the same one the app uses for codes.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const code = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const base = process.env.PARAMPARA_PUBLIC_URL ?? "https://parampara-eta.vercel.app";
const expiresAt = new Date(Date.now() + hours * 3_600_000);

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const rows = Array.from({ length: count }, () => ({
  code: code(),
  role: values.role,
  district: values.district,
  label: values.label ?? null,
  is_sample: false,
  ...(group ? { max_uses: uses, expires_at: expiresAt.toISOString() } : {}),
}));
const { error } = await db.from("invites").insert(rows);
if (error) {
  const missing = ["42703", "PGRST204"].includes(error.code);
  console.error(
    missing
      ? "  ✗ the database has no group invites yet: the founder applies 0007 first (ALLOW_DB_PUSH=1 pnpm db:push)"
      : `  ✗ could not create invites (${error.code})`,
  );
  process.exit(1);
}

mkdirSync("field-private", { recursive: true });
const file = "field-private/invites.txt";
const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
const until = expiresAt.toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});
appendFileSync(
  file,
  rows
    .map((r) =>
      group
        ? `${stamp}\tteacher group QR (${uses} places, open until ${until} IST)\t${r.label ?? ""}\t${base}/join/${r.code}`
        : `${stamp}\t${r.role}\t${r.label ?? ""}\t${base}/join/${r.code}`,
    )
    .join("\n") + "\n",
);
chmodSync(file, 0o600);

if (!group) {
  console.log(
    `  ✓ ${count} ${values.role} link${count > 1 ? "s" : ""} written to ${file} (open it yourself; links are not printed)`,
  );
  process.exit(0);
}

// The QR as a PNG: dark ink on white, medium error correction, a 4 module quiet zone, 16 px a
// module (about 600 px square), which WhatsApp keeps sharp and a phone screen shows at once.
const [row] = rows;
const qr = generate(`${base}/join/${row.code}`, { minCorrectionLevel: correction.M });
const slug =
  (values.label ?? "group")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "group";
const png = `field-private/qr-${slug}-${row.code}.png`;
writeFileSync(png, toPngBuffer(qr, { on: [21, 48, 42], off: [255, 255, 255], pad: 4, scale: 16 }));
chmodSync(png, 0o600);
console.log(`  ✓ one group QR for up to ${uses} teachers, open until ${until} IST`);
console.log(`    PNG: ${png}  (send it to the headmaster yourself; the link is in ${file})`);
console.log(`    Reviewers can also show it from /r/invites (Show QR).`);
