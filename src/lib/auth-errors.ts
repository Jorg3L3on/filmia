const CREDENTIALS_SIGNIN = "CredentialsSignin";

export const messageForSignInError = (
  error: string | undefined | null,
  context: "login" | "register" = "login",
) => {
  if (error === CREDENTIALS_SIGNIN) {
    return context === "register"
      ? "Cuenta creada, pero no se pudo iniciar sesión. Prueba en Entrar."
      : "Correo o contraseña incorrectos.";
  }

  return "No se pudo iniciar sesión. Reintenta en unos segundos.";
};
