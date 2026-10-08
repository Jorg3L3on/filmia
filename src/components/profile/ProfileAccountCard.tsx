"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { updateAccount, updatePassword, type ProfileActionState } from "@/app/actions/profile";
import { Button } from "@/components/Button";
import { PasswordField } from "@/components/PasswordField";
import {
  CheckIcon,
  GoogleGlyph,
  LockIcon,
  MailIcon,
  PersonIcon,
  ProfileGroup,
  ProfileRow,
  ProfileSection,
} from "@/components/profile/ProfileRows";
import { Sheet, SheetHandle, useOpenGeneration } from "@/components/Sheet";
import { cn } from "@/lib/cn";
import { showToast } from "@/lib/toast";
import { fieldClass } from "@/lib/ui";

type ProfileAccountCardProps = {
  name: string | null;
  email: string;
  hasPassword: boolean;
  googleLinked: boolean;
};

type Editing = "name" | "email" | "password";

/** Each failed submit bumps `attempt` so the field shakes again. */
type AttemptState = { result: ProfileActionState; attempt: number };

const INITIAL: AttemptState = { result: null, attempt: 0 };

const errorOf = (state: AttemptState) =>
  state.result && "error" in state.result ? state.result.error : null;

/** One short shake per failed attempt (beui Input «error shake»); none with reduced motion. */
const useShakeOnError = (attempt: number) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (attempt === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    ref.current?.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 320, easing: "cubic-bezier(0.34, 1.4, 0.64, 1)" },
    );
  }, [attempt]);
  return ref;
};

/** Perfil «Cuenta»: name, email, password and Google in one card; every edit happens in a sheet. */
export const ProfileAccountCard = ({ name, email, hasPassword, googleLinked }: ProfileAccountCardProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  // Kept after closing so the sheet keeps its content while it slides away.
  const [editing, setEditing] = useState<Editing>("name");
  const generation = useOpenGeneration(sheetOpen);
  const titleId = useId();

  const open = (next: Editing) => {
    setEditing(next);
    setSheetOpen(true);
  };
  const close = () => setSheetOpen(false);

  return (
    <ProfileSection id="cuenta" title="Cuenta">
      <ProfileGroup>
        <ProfileRow
          icon={<PersonIcon />}
          label="Nombre"
          value={name ?? <span className="text-faint">Añade tu nombre</span>}
          onClick={() => open("name")}
          ariaLabel={name ? `Nombre: ${name}. Cambiar` : "Añadir nombre"}
        />
        <ProfileRow
          icon={<MailIcon />}
          label="Correo"
          value={email}
          onClick={() => open("email")}
          ariaLabel={`Correo: ${email}. Cambiar`}
        />
        {hasPassword ? (
          <ProfileRow
            icon={<LockIcon />}
            label="Contraseña"
            value={
              <>
                <span className="tracking-[0.12em]">••••••••</span>
                <span className="ml-2 text-accent">Cambiar</span>
              </>
            }
            onClick={() => open("password")}
            ariaLabel="Cambiar contraseña"
          />
        ) : (
          <ProfileRow icon={<LockIcon />} label="Contraseña" hint="Sin contraseña: entras con Google" />
        )}
        {googleLinked ? (
          <ProfileRow
            icon={<GoogleGlyph />}
            iconClassName="bg-paper text-ink"
            label="Google"
            value={
              <span className="inline-flex items-center gap-1.5 text-success">
                <CheckIcon className="size-3.5" />
                Vinculada
              </span>
            }
          />
        ) : null}
      </ProfileGroup>

      <Sheet open={sheetOpen} onClose={close} labelledBy={titleId} align="bottom">
        <div className="profile-sheet flex flex-col px-5 pt-3">
          <SheetHandle className="self-center" />
          {editing === "password" ? (
            <PasswordForm key={generation} titleId={titleId} onDone={close} />
          ) : (
            <AccountFieldForm key={generation} titleId={titleId} kind={editing} name={name} email={email} onDone={close} />
          )}
        </div>
      </Sheet>
    </ProfileSection>
  );
};

const FIELD_COPY = {
  name: { title: "Nombre", lede: "Así te saluda Filmia.", saved: "Nombre guardado" },
  email: { title: "Correo", lede: "Con este correo entras a Filmia.", saved: "Correo guardado" },
} as const;

const AccountFieldForm = ({
  titleId,
  kind,
  name,
  email,
  onDone,
}: {
  titleId: string;
  kind: "name" | "email";
  name: string | null;
  email: string;
  onDone: () => void;
}) => {
  const copy = FIELD_COPY[kind];
  const fieldId = useId();
  // Controlled: React resets uncontrolled fields after every action, which would wipe a rejected edit.
  const [draft, setDraft] = useState(kind === "name" ? (name ?? "") : email);
  const [state, action, isPending] = useActionState<AttemptState, FormData>(async (previous, formData) => {
    const result = await updateAccount(previous.result, formData);
    if (result && "ok" in result) {
      showToast({ title: copy.saved });
      onDone();
      return { result, attempt: previous.attempt };
    }
    return { result, attempt: previous.attempt + 1 };
  }, INITIAL);
  const error = errorOf(state);
  const shakeRef = useShakeOnError(state.attempt);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <h2 id={titleId} className="font-serif text-2xl text-paper">
          {copy.title}
        </h2>
        <p className="text-sm text-fog">{copy.lede}</p>
      </div>
      <label htmlFor={fieldId} className="sr-only">
        {copy.title}
      </label>
      <div ref={shakeRef}>
        {kind === "name" ? (
          <>
            <input
              id={fieldId}
              type="text"
              name="name"
              autoComplete="name"
              maxLength={80}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Cómo quieres que te vean"
              aria-invalid={error ? true : undefined}
              className={cn(fieldClass, "h-12")}
            />
            <input type="hidden" name="email" value={email} />
          </>
        ) : (
          <>
            <input
              id={fieldId}
              type="email"
              name="email"
              autoComplete="email"
              required
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="tu@correo.com"
              aria-invalid={error ? true : undefined}
              className={cn(fieldClass, "h-12")}
            />
            <input type="hidden" name="name" value={name ?? ""} />
          </>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full press-scale" pending={isPending} pendingLabel="Guardando…">
        Guardar
      </Button>
    </form>
  );
};

const CURRENT_PASSWORD_ERROR = "La contraseña actual no es correcta.";

const PasswordForm = ({ titleId, onDone }: { titleId: string; onDone: () => void }) => {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [state, action, isPending] = useActionState<AttemptState, FormData>(async (previous, formData) => {
    const result = await updatePassword(previous.result, formData);
    if (result && "ok" in result) {
      showToast({ title: "Contraseña actualizada" });
      onDone();
      return { result, attempt: previous.attempt };
    }
    return { result, attempt: previous.attempt + 1 };
  }, INITIAL);
  const error = errorOf(state);
  const shakeRef = useShakeOnError(state.attempt);
  const currentError = error === CURRENT_PASSWORD_ERROR ? error : undefined;
  const generalError = error && !currentError ? error : null;
  const longEnough = next.length >= 8;

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <h2 id={titleId} className="font-serif text-2xl text-paper">
          Cambiar contraseña
        </h2>
        <p className="text-sm text-fog">Usa el ojo para revisar lo que escribes.</p>
      </div>
      <div ref={shakeRef} className="space-y-4">
        <PasswordField
          name="currentPassword"
          label="Contraseña actual"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          error={currentError}
        />
        <PasswordField
          name="newPassword"
          label="Nueva contraseña"
          autoComplete="new-password"
          minLength={8}
          placeholder="Mínimo 8 caracteres"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          error={generalError ?? undefined}
        >
          <span className={cn("flex items-center gap-1.5 text-xs transition-colors duration-[var(--duration-tab)]", longEnough ? "text-success" : "text-mist")}>
            {longEnough ? <CheckIcon className="size-3.5" /> : null}
            Mínimo 8 caracteres
          </span>
        </PasswordField>
      </div>
      <Button type="submit" size="lg" className="w-full press-scale" pending={isPending} pendingLabel="Guardando…">
        Guardar
      </Button>
    </form>
  );
};
