import test from "node:test";
import assert from "node:assert/strict";
import { loadMain } from "./helpers/loadMain.mjs";

test("updater:pending-app handler does not throw (loadPendingAppUpdate imported)", async () => {
  const m = await loadMain();
  try {
    const h = m.handlers.get("updater:pending-app");
    assert.equal(typeof h, "function", "handler registered");
    const res = await h({});
    assert.equal(res, null, "no pending update -> null");
  } finally {
    m.restore();
  }
});