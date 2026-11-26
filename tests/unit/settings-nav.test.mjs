import test from "node:test";
import assert from "node:assert/strict";
import { SETTINGS_NAV, SETTINGS_GROUPS } from "../../assets/app/data/settings-nav.js";
import { SETTINGS_SECTIONS, SETTINGS_GROUPS as SCHEMA_GROUPS } from "../../assets/app/data/settings-schema.js";

test("settings nav index matches the schema exactly (same order, titles, icons, groups)", () => {
  const fromSchema = SETTINGS_SECTIONS.map(({ key, title, icon, group }) => ({ key, title, icon, group }));
  assert.deepEqual(SETTINGS_NAV, fromSchema);
});

test("settings groups are a single shared source", () => {
  assert.equal(SCHEMA_GROUPS, SETTINGS_GROUPS);
  for (const item of SETTINGS_NAV) assert.ok(SETTINGS_GROUPS.some((g) => g.id === item.group), item.key);
});
