import { SuccessToast } from "@/components/SuccessToast";
import { ProfileAccountForm } from "@/components/ProfileAccountForm";
import { ProfilePasswordForm } from "@/components/ProfilePasswordForm";
import { StreamingPlatformPicker } from "@/components/StreamingPlatformPicker";
import { getCurrentUserProfile } from "@/lib/queries";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Perfil",
} as const;

const savedToast = (value: string | string[] | undefined) => {
  const key = Array.isArray(value) ? value[0] : value;
  if (key === "cuenta") {
    return {
      title: "Cambios guardados",
      description: "Tu información se actualizó correctamente.",
    };
  }
  if (key === "clave") {
    return {
      title: "Contraseña actualizada",
      description: "Tu información se actualizó correctamente.",
    };
  }
  if (key === "plataformas" || key === "1") {
    return {
      title: "Plataformas guardadas",
      description: "Tu información se actualizó correctamente.",
    };
  }
  return null;
};

export default async function ProfilePage({
  searchParams,
}: PageProps<"/perfil">) {
  const params = await searchParams;
  const toast = savedToast(params.guardado);
  const profile = await getCurrentUserProfile();

  if (!profile) {
    notFound();
  }

  const initial = (profile.name?.trim() || profile.email).slice(0, 1).toUpperCase();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-4xl tracking-tight text-paper">Perfil</h1>
        <span
          className="flex h-11 w-11 items-center justify-center rounded-full bg-well text-sm font-semibold text-paper"
          aria-hidden="true"
        >
          {initial}
        </span>
      </header>

      {toast ? <SuccessToast title={toast.title} description={toast.description} /> : null}

      <ProfileAccountForm name={profile.name} email={profile.email} />
      <ProfilePasswordForm />
      <StreamingPlatformPicker selected={profile.streamingPlatforms} />
    </div>
  );
}
