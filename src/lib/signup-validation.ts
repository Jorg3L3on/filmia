export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MAX_LENGTH = 60;

export type SignupField = "name" | "email" | "password";
export type SignupFieldErrors = Partial<Record<SignupField, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const validateName = (value: string): string | undefined =>
  value.trim().length > NAME_MAX_LENGTH
    ? `Usa ${NAME_MAX_LENGTH} caracteres o menos.`
    : undefined;

export const validateEmail = (value: string): string | undefined => {
  const email = normalizeEmail(value);
  if (!email) {
    return "Escribe tu correo.";
  }
  if (!EMAIL_PATTERN.test(email)) {
    return "Ese correo no parece válido. Revisa que tenga la forma tu@correo.com.";
  }
  return undefined;
};

export const validatePassword = (value: string): string | undefined => {
  if (!value) {
    return "Elige una contraseña.";
  }
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Faltan ${PASSWORD_MIN_LENGTH - value.length} caracteres: mínimo ${PASSWORD_MIN_LENGTH}.`;
  }
  return undefined;
};

export const validateSignup = (input: {
  name: string;
  email: string;
  password: string;
}): SignupFieldErrors => {
  const errors: SignupFieldErrors = {};
  const name = validateName(input.name);
  const email = validateEmail(input.email);
  const password = validatePassword(input.password);
  if (name) errors.name = name;
  if (email) errors.email = email;
  if (password) errors.password = password;
  return errors;
};

/** Document order, so the first invalid field can take focus. */
export const SIGNUP_FIELD_ORDER: readonly SignupField[] = ["name", "email", "password"];

const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmaill.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gamil.com": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com",
  "outlook.con": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "iclod.com": "icloud.com",
  "icloud.con": "icloud.com",
};

/** «ana@gmial.com» → «ana@gmail.com», or null when the domain looks fine. */
export const suggestEmailFix = (value: string): string | null => {
  const email = normalizeEmail(value);
  const at = email.lastIndexOf("@");
  if (at < 1) {
    return null;
  }
  const fixed = COMMON_DOMAIN_TYPOS[email.slice(at + 1)];
  return fixed ? `${email.slice(0, at + 1)}${fixed}` : null;
};

export type PasswordStrength = {
  /** 0 = empty, 1 = weak, 2 = fair, 3 = good, 4 = strong. */
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
};

const STRENGTH_LABELS = ["", "Débil", "Aceptable", "Buena", "Fuerte"] as const;

const WEAK_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "qwertyui",
  "qwerty123",
  "contraseña",
  "contrasena",
  "11111111",
  "abcd1234",
  "iloveyou",
]);

/** Length-first heuristic: a hint for the person typing, not a gate (the server only enforces the minimum). */
export const passwordStrength = (value: string): PasswordStrength => {
  if (!value) {
    return { level: 0, label: STRENGTH_LABELS[0] };
  }

  if (WEAK_PASSWORDS.has(value.toLowerCase()) || /^(.)\1+$/.test(value)) {
    return { level: 1, label: STRENGTH_LABELS[1] };
  }

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;
  let level: 1 | 2 | 3 | 4;
  if (value.length < PASSWORD_MIN_LENGTH) {
    level = 1;
  } else if (value.length >= 16 || (value.length >= 12 && classes >= 3)) {
    level = 4;
  } else if (value.length >= 12 || classes >= 3) {
    level = 3;
  } else {
    level = 2;
  }
  return { level, label: STRENGTH_LABELS[level] };
};
