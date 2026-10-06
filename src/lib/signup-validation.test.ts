import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  passwordStrength,
  suggestEmailFix,
  validateEmail,
  validatePassword,
  validateSignup,
} from "./signup-validation";

describe("validateEmail", () => {
  it("rejects empty and malformed addresses", () => {
    assert.ok(validateEmail(""));
    assert.ok(validateEmail("   "));
    assert.ok(validateEmail("ana"));
    assert.ok(validateEmail("ana@"));
    assert.ok(validateEmail("ana@correo"));
    assert.ok(validateEmail("ana @correo.com"));
  });

  it("accepts ordinary addresses, trimmed and any case", () => {
    assert.equal(validateEmail("ana@correo.com"), undefined);
    assert.equal(validateEmail("  Ana.Lopez+filmia@Correo.COM "), undefined);
  });
});

describe("validatePassword", () => {
  it("asks for the missing characters", () => {
    assert.match(validatePassword("abc") ?? "", /Faltan 5/);
    assert.ok(validatePassword(""));
  });

  it("accepts the minimum", () => {
    assert.equal(validatePassword("12345678"), undefined);
  });
});

describe("validateSignup", () => {
  it("collects one error per invalid field", () => {
    const errors = validateSignup({ name: "", email: "nope", password: "x" });
    assert.deepEqual(Object.keys(errors).sort(), ["email", "password"]);
  });

  it("is empty for a valid form", () => {
    assert.deepEqual(
      validateSignup({ name: "Ana", email: "ana@correo.com", password: "una-clave-larga" }),
      {},
    );
  });
});

describe("suggestEmailFix", () => {
  it("fixes common domain typos and keeps the local part", () => {
    assert.equal(suggestEmailFix("Ana@gmial.com"), "ana@gmail.com");
    assert.equal(suggestEmailFix("ana@hotmail.con"), "ana@hotmail.com");
  });

  it("stays quiet for fine or incomplete addresses", () => {
    assert.equal(suggestEmailFix("ana@gmail.com"), null);
    assert.equal(suggestEmailFix("ana@"), null);
    assert.equal(suggestEmailFix("ana"), null);
  });
});

describe("passwordStrength", () => {
  it("is empty for no input", () => {
    assert.equal(passwordStrength("").level, 0);
  });

  it("flags short, common and repeated passwords as weak", () => {
    assert.equal(passwordStrength("abc").level, 1);
    assert.equal(passwordStrength("12345678").level, 1);
    assert.equal(passwordStrength("aaaaaaaaaa").level, 1);
  });

  it("rewards length and variety", () => {
    assert.equal(passwordStrength("abcdefgh").level, 2);
    assert.equal(passwordStrength("Abcdefg1").level, 3);
    assert.equal(passwordStrength("una frase larga y facil").level, 4);
  });
});
