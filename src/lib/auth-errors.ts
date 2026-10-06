import { GOOGLE_SIGN_IN_ERRORS } from "@/lib/google-oauth";

const CREDENTIALS_SIGNIN = "CredentialsSignin";

const GOOGLE_MESSAGES: Record<(typeof GOOGLE_SIGN_IN_ERRORS)[number], string> = {
  disabled: "El acceso con Google no está configurado en esta instancia.",
  denied: "Cancelaste el acceso con Google.",
  state: "La sesión con Google caducó. Vuelve a intentarlo.",
  token: "No se pudo verificar tu cuenta de Google. Reintenta en unos segundos.",
  email: "Tu correo de Google no está verificado. Verifícalo en Google y reintenta.",
};

/** Message for the `?error=` query the auth screens receive after a redirect. */
export const messageForSignInError = (
  error: string | undefined | null,
  context: "login" | "register" = "login",
) => {
  if (!error) {
    return null;
  }

  if (error === CREDENTIALS_SIGNIN) {
    return context === "register"
      ? "Cuenta creada, pero no se pudo iniciar sesión. Prueba en Entrar."
      : "Correo o contraseña incorrectos.";
  }

  if (error.startsWith("google_")) {
    const code = error.slice("google_".length);
    const known = GOOGLE_SIGN_IN_ERRORS.find((candidate) => candidate === code);
    return known ? GOOGLE_MESSAGES[known] : GOOGLE_MESSAGES.token;
  }

  return "No se pudo iniciar sesión. Reintenta en unos segundos.";
};
