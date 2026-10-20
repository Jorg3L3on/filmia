import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { personFirstName, personHue, personInitials } from "./person-avatar";

describe("person avatars", () => {
  it("initials from first and last word", () => {
    assert.equal(personInitials("Ana Ruiz"), "AR");
    assert.equal(personInitials("Jorge  León Díaz"), "JD");
    assert.equal(personInitials("mariana"), "MA");
    assert.equal(personInitials(""), "?");
    assert.equal(personInitials(null), "?");
  });

  it("a stable hue per person", () => {
    assert.equal(personHue("user-1"), personHue("user-1"));
    assert.ok(personHue("user-1") >= 0 && personHue("user-1") < 360);
  });

  it("first names, with fallbacks", () => {
    assert.equal(personFirstName("Ana Ruiz"), "Ana");
    assert.equal(personFirstName(null), "Alguien");
    assert.equal(personFirstName("Ana", true), "Usuario eliminado");
  });
});
