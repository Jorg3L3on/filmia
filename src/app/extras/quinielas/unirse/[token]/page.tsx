import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NavLabel } from "@/components/NavOriginTracker";
import { QuinielaGroupJoin } from "@/components/quinielas/QuinielaGroupControls";
import { getCeremony } from "@/lib/quinielas/ceremonies";
import { getGroupByToken, isGroupMember } from "@/lib/quinielas/groups";
import { ceremonyInfo } from "@/lib/quinielas/hub-core";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Quinielas de premios", robots: { index: false, follow: false } };

/**
 * An invite to a quiniela group (FIL-I51-3). Signed out, the proxy sends it through sign-in and
 * back here. A wrong or regenerated link is a 404, with nothing about the group.
 */
export default async function UnirsePage({ params }: { params: Promise<{ token: string }> }) {
  const userId = await requireUserId();
  const { token } = await params;
  const group = await getGroupByToken(token);
  const file = group ? getCeremony(group.ceremonyId) : null;
  if (!group || !file) {
    notFound();
  }
  if (await isGroupMember(group.id, userId)) {
    redirect(`/extras/quinielas/grupo/${group.id}`);
  }
  const ceremony = ceremonyInfo(file);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 pt-10 text-center" data-quiniela-join>
      <NavLabel label={ceremony.title} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-star">{ceremony.title}</p>
      <div className="space-y-2">
        <p className="text-sm text-fog">{group.ownerName} te reta en</p>
        <h1 className="font-serif text-[2.1rem] leading-[1.05] text-paper">{group.name}</h1>
      </div>
      <p className="text-sm text-fog">
        Elige quién gana cada categoría y la noche de la ceremonia ve quién atinó más. Al entrar, el grupo verá tu boleta y
        tú la de los demás.
      </p>
      <QuinielaGroupJoin token={token} />
    </div>
  );
}
