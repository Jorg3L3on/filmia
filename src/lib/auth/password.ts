const PBKDF2_PREFIX = "pbkdf2";
const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

const fromBase64 = (value: string) => new Uint8Array(Buffer.from(value, "base64"));

export const hashPassword = async (password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_BYTES * 8,
  );

  return [
    PBKDF2_PREFIX,
    PBKDF2_ITERATIONS,
    toBase64(salt),
    toBase64(new Uint8Array(derived)),
  ].join("$");
};

const isLegacyBcryptHash = (storedHash: string) =>
  storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$");

export const verifyPassword = async (password: string, storedHash: string) => {
  if (isLegacyBcryptHash(storedHash)) {
    const { compare } = await import("bcryptjs");
    return compare(password, storedHash);
  }

  if (!storedHash.startsWith(`${PBKDF2_PREFIX}$`)) {
    return false;
  }

  const [, iterationsRaw, saltB64, hashB64] = storedHash.split("$");
  const iterations = Number(iterationsRaw);

  if (!iterations || !saltB64 || !hashB64) {
    return false;
  }

  const salt = fromBase64(saltB64);
  const expected = fromBase64(hashB64);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    expected.byteLength * 8,
  );

  const actual = new Uint8Array(derived);
  if (actual.length !== expected.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < actual.length; index += 1) {
    mismatch |= actual[index]! ^ expected[index]!;
  }

  return mismatch === 0;
};

export const needsPasswordUpgrade = (storedHash: string) =>
  isLegacyBcryptHash(storedHash);
