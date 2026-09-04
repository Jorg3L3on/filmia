import { PageHeader } from "@/components/PageHeader";
import { ProfileAccountForm } from "@/components/ProfileAccountForm";
import { ProfilePasswordForm } from "@/components/ProfilePasswordForm";
import { StreamingPlatformPicker } from "@/components/StreamingPlatformPicker";
import { getCurrentUserProfile } from "@/lib/queries";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Perfil",
} as const;

const savedMessage = (value: string | string[] | undefined) => {
  const key = Array.isArray(value) ? value[0] : value;
  if (key === "cuenta") {
    return "Datos de la cuenta guardados.";
  }
  if (key === "clave") {
    return "Contraseña actualizada.";
  }
  if (key === "plataformas" || key === "1") {
    return "Plataformas guardadas.";
  }
  return null;
};

export default async function ProfilePage({
  searchParams,
}: PageProps<"/perfil">) {
  const params = await searchParams;
  const saved = savedMessage(params.guardado);
  const profile = await getCurrentUserProfile();

  if (!profile) {
    notFound();
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Cuenta"
        title="Perfil"
        description="Actualiza tu nombre, correo o contraseña, y elige las plataformas que tienes en México. Filmia las destaca en cada ficha y filtra el diario, Quiero ver y las listas."
      />

      {saved ? (
        <p
          role="status"
          className="rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-white"
        >
          {saved}
        </p>
      ) : null}

      <ProfileAccountForm name={profile.name} email={profile.email} />
      <ProfilePasswordForm />
      <StreamingPlatformPicker selected={profile.streamingPlatforms} />
    </div>
  );
}
