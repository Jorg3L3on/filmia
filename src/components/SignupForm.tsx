"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { Button } from "@/components/Button";
import { AuthDivider, GoogleSignInButton } from "@/components/GoogleSignInButton";
import { PasswordField } from "@/components/PasswordField";
import { messageForSignInError } from "@/lib/auth-errors";
import { cn } from "@/lib/cn";
import { safeNextPath } from "@/lib/google-oauth";
import { ONBOARDING_PATH } from "@/lib/onboarding/steps";
import {
  PASSWORD_MIN_LENGTH,
  SIGNUP_FIELD_ORDER,
  passwordStrength,
  suggestEmailFix,
  validateEmail,
  validateName,
  validatePassword,
  validateSignup,
  type SignupField,
  type SignupFieldErrors,
} from "@/lib/signup-validation";
import { fieldClass, focusRing } from "@/lib/ui";

type SignupFormProps = {
  googleEnabled: boolean;
};

type RegisterPayload = {
  error?: string;
  fieldErrors?: SignupFieldErrors;
  existingAccount?: boolean;
};

const fieldValidators: Record<SignupField, (value: string) => string | undefined> = {
  name: validateName,
  email: validateEmail,
  password: validatePassword,
};

const STRENGTH_BAR_CLASS = [
  "",
  "bg-danger",
  "bg-star",
  "bg-success",
  "bg-success",
] as const;

export const SignupForm = ({ googleEnabled }: SignupFormProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("callbackUrl"));
  const loginHref = next === "/" ? "/login" : `/login?callbackUrl=${encodeURIComponent(next)}`;

  const [formError, setFormError] = useState<string | null>(() =>
    messageForSignInError(searchParams.get("error"), "register"),
  );
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [existingAccount, setExistingAccount] = useState(false);
  const [emailFix, setEmailFix] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const inputRefs = { name: nameRef, email: emailRef, password: passwordRef };

  const setFieldError = (field: SignupField, message: string | undefined) => {
    setFieldErrors((current) => ({ ...current, [field]: message }));
  };

  const handleBlur = (field: SignupField) => (event: React.FocusEvent<HTMLInputElement>) => {
    const value = event.target.value;
    // An untouched, empty optional/blank field isn't an error until submit.
    if (!value && field !== "name") {
      return;
    }
    setFieldError(field, fieldValidators[field](value));
    if (field === "email") {
      setEmailFix(suggestEmailFix(value));
    }
  };

  // Once a field has shown an error, re-check as the person fixes it.
  const handleChange = (field: SignupField) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (field === "password") {
      setPassword(value);
    }
    if (field === "email") {
      setEmailFix(null);
      setExistingAccount(false);
    }
    if (fieldErrors[field]) {
      setFieldError(field, fieldValidators[field](value));
    }
  };

  const applyEmailFix = () => {
    if (!emailFix || !emailRef.current) {
      return;
    }
    emailRef.current.value = emailFix;
    setEmailFix(null);
    setFieldError("email", undefined);
    emailRef.current.focus();
  };

  const focusFirstInvalid = (errors: SignupFieldErrors) => {
    const first = SIGNUP_FIELD_ORDER.find((field) => errors[field]);
    if (first) {
      inputRefs[first].current?.focus();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) {
      return;
    }
    setFormError(null);
    setExistingAccount(false);

    const formData = new FormData(event.currentTarget);
    const clientErrors = validateSignup({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
    setFieldErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      focusFirstInvalid(clientErrors);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/register", { method: "POST", body: formData });
      const payload = (await response.json().catch(() => ({}))) as RegisterPayload;

      if (!response.ok) {
        const serverErrors = payload.fieldErrors ?? {};
        setFieldErrors(serverErrors);
        setExistingAccount(Boolean(payload.existingAccount));
        if (Object.keys(serverErrors).length > 0) {
          focusFirstInvalid(serverErrors);
        } else {
          setFormError(payload.error ?? "No se pudo crear la cuenta. Reintenta en unos segundos.");
        }
        return;
      }

      // A fresh account always opens the Bienvenida; finishing it lands on Hoy.
      router.push(ONBOARDING_PATH);
      router.refresh();
    } catch {
      setFormError("No pudimos conectar. Revisa tu conexión y reintenta.");
    } finally {
      setIsLoading(false);
    }
  };

  const strength = passwordStrength(password);

  return (
    <AuthScreen
      title="Crear cuenta en Filmia"
      footer={
        <p className="text-center text-sm text-mist">
          Ya tengo cuenta{" "}
          <Link href={loginHref} className={`text-accent hover:text-accent-hover ${focusRing}`}>
            → Entrar
          </Link>
        </p>
      }
    >
      {formError ? (
        <p
          role="alert"
          className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger"
        >
          {formError}
        </p>
      ) : null}

      {googleEnabled ? (
        <div className="space-y-6">
          <GoogleSignInButton next={next} />
          <AuthDivider label="o con tu correo" />
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-fog">
            Nombre <span className="normal-case tracking-normal text-faint">(opcional)</span>
          </span>
          <input
            ref={nameRef}
            type="text"
            name="name"
            autoComplete="name"
            className={fieldClass}
            placeholder="Tu nombre"
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={fieldErrors.name ? "signup-name-error" : undefined}
            onBlur={handleBlur("name")}
            onChange={handleChange("name")}
          />
          {fieldErrors.name ? (
            <span id="signup-name-error" className="block text-xs text-danger">
              {fieldErrors.name}
            </span>
          ) : null}
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-fog">Correo</span>
          <input
            ref={emailRef}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            className={fieldClass}
            placeholder="tu@correo.com"
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={
              fieldErrors.email ? "signup-email-error" : emailFix ? "signup-email-fix" : undefined
            }
            onBlur={handleBlur("email")}
            onChange={handleChange("email")}
          />
          {fieldErrors.email ? (
            <span id="signup-email-error" className="block text-xs text-danger">
              {fieldErrors.email}
              {existingAccount ? (
                <>
                  {" "}
                  <Link href={loginHref} className={cn("font-medium underline", focusRing)}>
                    Entrar
                  </Link>
                </>
              ) : null}
            </span>
          ) : emailFix ? (
            <span id="signup-email-fix" className="block text-xs text-mist">
              ¿Quisiste decir{" "}
              <button
                type="button"
                onClick={applyEmailFix}
                className={cn("font-medium text-accent hover:text-accent-hover", focusRing)}
              >
                {emailFix}
              </button>
              ?
            </span>
          ) : null}
        </label>

        <PasswordField
          name="password"
          label="Contraseña"
          autoComplete="new-password"
          placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
          inputRef={passwordRef}
          error={fieldErrors.password}
          onBlur={handleBlur("password")}
          onChange={handleChange("password")}
        >
          <span className="flex items-center gap-2" aria-live="polite">
            <span className="flex flex-1 gap-1" aria-hidden="true">
              {[1, 2, 3, 4].map((segment) => (
                <span
                  key={segment}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors duration-[var(--duration-hover)]",
                    segment <= strength.level ? STRENGTH_BAR_CLASS[strength.level] : "bg-line",
                  )}
                />
              ))}
            </span>
            <span className="w-16 text-right text-xs text-mist">{strength.label}</span>
          </span>
        </PasswordField>

        <Button type="submit" pending={isLoading} pendingLabel="Creando…" className="w-full">
          Crear cuenta
        </Button>
      </form>
    </AuthScreen>
  );
};
