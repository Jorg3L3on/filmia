"use client";

import { useId, useState, type ChangeEventHandler, type FocusEventHandler, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/cn";
import { fieldClass, focusRing } from "@/lib/ui";

type PasswordFieldProps = {
  name: string;
  label: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  ariaLabel?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  inputRef?: Ref<HTMLInputElement>;
  /** Validation message; shown under the field and announced with the input. */
  error?: string;
  /** Extra content under the field (hints, strength meter). */
  children?: ReactNode;
};

export const PasswordField = ({
  name,
  label,
  autoComplete = "current-password",
  placeholder = "••••••••",
  required = true,
  minLength,
  ariaLabel,
  onChange,
  onBlur,
  inputRef,
  error,
  children,
}: PasswordFieldProps) => {
  const [visible, setVisible] = useState(false);
  const errorId = useId();

  const handleToggle = () => {
    setVisible((current) => !current);
  };

  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-fog">{label}</span>
      <span className="relative block">
        <input
          type={visible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className={`${fieldClass} pr-11`}
          placeholder={placeholder}
          aria-label={ariaLabel ?? label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={onChange}
          onBlur={onBlur}
          ref={inputRef}
        />
        <button
          type="button"
          onClick={handleToggle}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          className={cn(
            "absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 text-mist hover:text-paper",
            focusRing,
          )}
        >
          <EyeIcon off={visible} />
        </button>
      </span>
      {error ? (
        <span id={errorId} className="block text-xs text-danger">
          {error}
        </span>
      ) : null}
      {children}
    </label>
  );
};

const EyeIcon = ({ off }: { off: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    aria-hidden="true"
  >
    <path strokeLinejoin="round" d="M3.5 12s3.2-6 8.5-6 8.5 6 8.5 6-3.2 6-8.5 6-8.5-6-8.5-6Z" />
    <circle cx="12" cy="12" r="2.25" />
    {off ? <path strokeLinecap="round" d="m5 19 14-14" /> : null}
  </svg>
);
