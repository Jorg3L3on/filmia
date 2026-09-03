import { PageHeader } from "@/components/PageHeader";
import { StreamingPlatformPicker } from "@/components/StreamingPlatformPicker";
import { getCurrentUserProfile } from "@/lib/queries";
import { wellClass } from "@/lib/ui";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Perfil",
} as const;

export default async function ProfilePage({
  searchParams,
}: PageProps<"/perfil">) {
  const params = await searchParams;
  const saved = params.guardado === "1";
  const profile = await getCurrentUserProfile();

  if (!profile) {
    notFound();
  }

  const displayName = profile.name?.trim() || profile.email;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cuenta"
        title="Perfil"
        description="Elige las plataformas que tienes contratadas. Filmia las recuerda y las destaca en cada ficha."
      />

      {saved ? (
        <p
          role="status"
          className="rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-white"
        >
          Plataformas guardadas.
        </p>
      ) : null}

      <section className={`${wellClass} space-y-2 p-5`}>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-fog">
          Sesión
        </p>
        <p className="font-serif text-2xl text-white">{displayName}</p>
        {profile.name?.trim() ? (
          <p className="text-sm text-fog">{profile.email}</p>
        ) : null}
      </section>

      <StreamingPlatformPicker selected={profile.streamingPlatforms} />
    </div>
  );
}
