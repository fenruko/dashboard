import test from "node:test";
import assert from "node:assert/strict";

import {
  clamp,
  csvCell,
  deepEqual,
  fmtClock,
  fmtCompact,
  fmtDuration,
  fmtInt,
  fmtMoney,
  fmtPercent,
  fmtRelative,
  fmtSigned,
  safeJsonParse,
  snowflakeCreatedAt,
  sortRows,
  titleCase,
  toCsv,
  toEpochMs,
  truncate,
} from "../../assets/app/core/format.js";

test("number formatters stay readable at every scale", () => {
  assert.equal(fmtInt(1234567), "1,234,567");
  assert.equal(fmtCompact(1234), "1.2K");
  assert.equal(fmtCompact(2_500_000), "2.5M");
  assert.equal(fmtMoney(1234.5), "$1,234.50");
  assert.equal(fmtSigned(2.345), "+2.35");
  assert.equal(fmtPercent(42.126), "42.1%");
  assert.equal(fmtInt(Number.NaN), "0");
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(clamp(-2, 0, 10), 0);
});

test("durations and clocks", () => {
  assert.equal(fmtDuration(90061), "1d 1h");
  assert.equal(fmtDuration(59), "59s");
  assert.equal(fmtDuration(0), "0s");
  assert.equal(fmtClock(65), "1:05");
  assert.equal(fmtClock(3661), "1:01:01");
  assert.equal(fmtClock(0), "0:00");
});

test("epoch conversion treats Discord seconds and JS milliseconds equally", () => {
  const seconds = 1_700_000_000;
  assert.equal(toEpochMs(seconds), seconds * 1000);
  assert.equal(toEpochMs(seconds * 1000), seconds * 1000);
  assert.equal(toEpochMs(null), null);
  assert.equal(toEpochMs("not-a-date"),
    Number.isFinite(Date.parse("not-a-date")) ? Date.parse("not-a-date") : null);
  const snowflake = "101010101010101010";
  assert.ok(snowflakeCreatedAt(snowflake) > 0);
});

test("relative time is stable for injected 'now'", () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);
  assert.equal(fmtRelative(now - 30_000, { now }), "just now");
  assert.equal(fmtRelative(now - 3_600_000, { now }), "1 hour ago");
  assert.equal(fmtRelative(now - 86_400_000 * 2, { now }), "2 days ago");
  assert.equal(fmtRelative(null, { now }), "—");
});

test("CSV output escapes separators, quotes and newlines", () => {
  assert.equal(csvCell("hello"), "hello");
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  const csv = toCsv([{ name: "Nova", note: "a,b" }, { name: "Iris", note: null }], ["name", "note"]);
  assert.equal(csv, 'name,note\r\nNova,"a,b"\r\nIris,');
});

test("deep equality, sorting and truncation", () => {
  assert.equal(deepEqual({ a: [1, 2], b: { c: true } }, { a: [1, 2], b: { c: true } }), true);
  assert.equal(deepEqual({ a: 1 }, { a: "1" }), false);
  assert.deepEqual(sortRows([{ n: 3 }, { n: 1 }, { n: 2 }], "n", "asc"), [{ n: 1 }, { n: 2 }, { n: 3 }]);
  assert.deepEqual(sortRows([{ n: 1 }, { n: 3 }, { n: 2 }], "n", "desc"), [{ n: 3 }, { n: 2 }, { n: 1 }]);
  assert.equal(truncate("abcdefghij", 5), "abcd…");
  assert.equal(truncate("short", 10), "short");
  assert.equal(titleCase("anti_nuke"), "Anti Nuke");
});

test("safe JSON parsing never throws", () => {
  assert.deepEqual(safeJsonParse('{"a":1}', {}), { a: 1 });
  assert.deepEqual(safeJsonParse("nope", { fallback: true }), { fallback: true });
  assert.deepEqual(safeJsonParse("", []), []);
});
