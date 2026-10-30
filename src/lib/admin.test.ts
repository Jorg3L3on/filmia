import "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adminEmails, isAdmin, requireAdmin } from "@/lib/admin";

const isNotFound = (error: unknown) =>
  typeof (error as { digest?: unknown })?.digest === "string" && (error as { digest: string }).digest.endsWith(";404");

describe("Admin · ADMIN_EMAILS (FIL-I37-3)", () => {
  it("reads a comma list, trimmed and case-insensitive", () => {
    assert.deepEqual([...adminEmails(" Admin@Ejemplo.com, otra@ejemplo.com ,,")], ["admin@ejemplo.com", "otra@ejemplo.com"]);
    assert.equal(isAdmin({ email: "ADMIN@ejemplo.com" }, "admin@ejemplo.com"), true);
  });

  it("empty or unset means nobody", () => {
    assert.equal(isAdmin({ email: "admin@ejemplo.com" }, ""), false);
    assert.equal(isAdmin({ email: "admin@ejemplo.com" }, undefined), false);
    assert.equal(isAdmin({ email: "" }, ","), false);
  });

  it("someone else and a logged-out visitor get a 404", async () => {
    const previous = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = "admin@ejemplo.com";
    try {
      await assert.rejects(requireAdmin(async () => ({ email: "ana@ejemplo.com" })), isNotFound);
      await assert.rejects(requireAdmin(async () => null), isNotFound);
      assert.deepEqual(await requireAdmin(async () => ({ email: "Admin@Ejemplo.com" })), { email: "Admin@Ejemplo.com" });
    } finally {
      process.env.ADMIN_EMAILS = previous;
    }
  });
});
