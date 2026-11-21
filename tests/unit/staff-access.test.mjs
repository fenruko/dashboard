import test from "node:test";
import assert from "node:assert/strict";

import {
  DIAGNOSTICS_PERMISSION,
  canViewDiagnostics,
  fetchStaffPermissions,
  hasStaffPermission,
  normalizeStaffPermissions,
} from "../../assets/app/core/staff-access.js";

const READY = (id, staffPermissions = []) => ({ status: "ready", user: { id }, staffPermissions });
const DEVELOPER_ID = "834869554798395392";

test("normalizeStaffPermissions accepts {permissions} or a bare list and drops junk", () => {
  assert.deepEqual(normalizeStaffPermissions({ permissions: ["a", " b ", "a", "", 3, null] }), ["a", "b"]);
  assert.deepEqual(normalizeStaffPermissions(["x"]), ["x"]);
  assert.deepEqual(normalizeStaffPermissions(null), []);
  assert.deepEqual(normalizeStaffPermissions({ permissions: "diagnostics.view" }), []);
  assert.deepEqual(normalizeStaffPermissions({}), []);
});

test("hasStaffPermission honours the full-access wildcard", () => {
  assert.equal(hasStaffPermission(["*"], DIAGNOSTICS_PERMISSION), true);
  assert.equal(hasStaffPermission([DIAGNOSTICS_PERMISSION], DIAGNOSTICS_PERMISSION), true);
  assert.equal(hasStaffPermission(["economy.view"], DIAGNOSTICS_PERMISSION), false);
  assert.equal(hasStaffPermission(undefined, DIAGNOSTICS_PERMISSION), false);
});

test("canViewDiagnostics: developers and permitted staff only", () => {
  assert.equal(canViewDiagnostics(READY("100000000000000001")), false, "regular account");
  assert.equal(canViewDiagnostics(READY("100000000000000001", ["economy.view"])), false, "wrong permission");
  assert.equal(canViewDiagnostics(READY("100000000000000001", [DIAGNOSTICS_PERMISSION])), true, "diagnostics.view");
  assert.equal(canViewDiagnostics(READY("100000000000000001", ["*"])), true, "full access");
  assert.equal(canViewDiagnostics(READY(DEVELOPER_ID)), true, "allow-listed developer");
  assert.equal(canViewDiagnostics({ status: "anonymous", user: null, staffPermissions: ["*"] }), false, "signed out");
  assert.equal(canViewDiagnostics({ status: "authenticating", user: { id: DEVELOPER_ID } }), false, "not ready yet");
  assert.equal(canViewDiagnostics(null), false);
});

test("fetchStaffPermissions fails closed", async () => {
  assert.deepEqual(await fetchStaffPermissions({ get: async () => ({ permissions: [DIAGNOSTICS_PERMISSION] }) }), [DIAGNOSTICS_PERMISSION]);
  assert.deepEqual(await fetchStaffPermissions({ get: async () => { throw Object.assign(new Error("nope"), { status: 404 }); } }), []);
  assert.deepEqual(await fetchStaffPermissions({ get: async () => "<html>" }), []);
});
