import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ICON_NAMES, hasIcon } from "../../assets/app/ui/icons.js";

const files = [];
for (const dir of ["assets/app/pages", "assets/app/ui", "assets/app/data"]) {
  for (const file of readdirSync(dir)) if (file.endsWith(".js")) files.push(join(dir, file));
}
files.push("assets/app/app.js");

test("every icon referenced by the UI exists in the sprite map", () => {
  const missing = new Set();
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/icon:\s*"([a-z0-9-]+)"/g)) {
      if (!hasIcon(match[1])) missing.add(`${match[1]} (${file})`);
    }
    for (const match of source.matchAll(/icon\(\s*"([a-z0-9-]+)"/g)) {
      if (!hasIcon(match[1])) missing.add(`${match[1]} (${file})`);
    }
  }
  assert.deepEqual([...missing].sort(), [], "missing icons fall back to a question mark");
});

test("settings section icons (from the schema) also exist", async () => {
  const { SETTINGS_SECTIONS } = await import("../../assets/app/data/settings-schema.js");
  for (const section of SETTINGS_SECTIONS) {
    assert.ok(hasIcon(section.icon), `${section.key} icon “${section.icon}” is missing`);
  }
});

test("the sprite list is non-trivial and has unique names", () => {
  assert.ok(ICON_NAMES.length >= 80);
  assert.equal(new Set(ICON_NAMES).size, ICON_NAMES.length);
});
