import type { Metadata } from "next";
import Link from "next/link";
import { collectionCountLabel } from "@/lib/labels";
import { redirect } from "next/navigation";
import { PosterImage } from "@/components/PosterImage";
import { PersonAvatar } from "@/components/lists/PersonAvatar";
import { JoinListActions, JoinPendingCard } from "@/components/lists/JoinListActions";
import { SharePage } from "@/components/share/SharePage";
import { listAccessFor } from "@/lib/list-access";
import { getInvitePreview, pendingRequestOf, pendingRequestThroughInvite } from "@/lib/list-invites";
import { personFirstName } from "@/lib/person-avatar";
import { shareMetadataBase } from "@/lib/share";
import { getLiveSessionUser } from "@/lib/session";
import { posterFrame } from "@/lib/ui";

export const dynamic = "force-dynamic";

type JoinPageProps = { params: Promise<{ token: string }> };

/** The preview does not know the kinds: «títulos» (UX-05). */
const filmsLabel = (count: number) => collectionCountLabel(count);

const roleLine = (role: "EDITOR" | "VIEWER") =>
  role === "EDITOR" ? "Podrás agregar y quitar" : "Podrás verla y ver quién agregó qué";

/** WhatsApp's preview (canvas 1·4): the list, whose it is and how many films. */
export const generateMetadata = async ({ params }: JoinPageProps): Promise<Metadata> => {
  const preview = await getInvitePreview((await params).token);
  if (!preview) {
    return { title: "Enlace no disponible", robots: { index: false, follow: false } };
  }
  const { list } = preview;
  const owner = personFirstName(list.ownerName);
  const title = `${list.name} · Filmia`;
  const description = `Lista de ${owner} · ${filmsLabel(list.total)}. ${roleLine(preview.invite.role)}.`;
  return {
    metadataBase: await shareMetadataBase(),
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", siteName: "Filmia" },
    twitter: { card: "summary_large_image", title, description },
  };
};

/**
 * `/unirse/[token]` (FIL-I18-3, canvas 2·1–2·4): the list first, then the
 * account, then a request the owner approves. A link that does not work shows
 * one message for every reason, and nothing about the list.
 */
export default async function JoinListPage({ params }: JoinPageProps) {
  const { token } = await params;
  const [preview, user] = await Promise.all([getInvitePreview(token), getLiveSessionUser()]);

  if (user && preview) {
    if (await listAccessFor(preview.list.id, user.id)) {
      redirect(`/listas/${preview.list.id}`);
    }
  }

  // Signed in, the app shell already has the page's <main> and the invitation to sign up is noise.
  const shell = { embedded: true, hideFooter: Boolean(user) };

  if (!preview) {
    // The one-time link was used by this user's own request (FIL-I41-16): show it as pending.
    const requested = user ? await pendingRequestThroughInvite(token, user.id) : null;
    if (requested) {
      return (
        <SharePage {...shell}>
          <section className="flex w-full flex-col items-center gap-5 text-center">
            <div className="space-y-2">
              <p className="text-sm text-fog">{requested.ownerName?.trim() || "Alguien"} te invitó a</p>
              <h1 className="font-serif text-[2.25rem] leading-[1.05] tracking-[-0.02em] text-paper">{requested.name}</h1>
            </div>
            <JoinPendingCard />
          </section>
        </SharePage>
      );
    }
    return (
      <SharePage {...shell}>
        <section className="w-full space-y-3 rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-8 text-center">
          <h1 className="font-serif text-2xl text-paper">Este enlace ya no sirve</h1>
          <p className="text-pretty text-sm text-fog">
            Puede que ya se haya usado, que haya vencido o que lo hayan apagado. Pídele un enlace nuevo a quien te lo
            mandó.
          </p>
          {user ? (
            <Link href="/" className="inline-flex h-10 items-center rounded-full bg-white/10 px-5 text-sm font-semibold text-paper">
              Ir a Hoy
            </Link>
          ) : null}
        </section>
      </SharePage>
    );
  }

  const { list, invite } = preview;
  const pending = user ? Boolean(await pendingRequestOf(list.id, user.id)) : false;
  const callback = `/unirse/${token}`;

  return (
    <SharePage {...shell}>
      <section className="flex w-full flex-col items-center gap-5 text-center">
        {list.posters.length > 0 ? (
          <div className="flex items-end justify-center -space-x-6" aria-hidden="true">
            {list.posters.slice(0, 3).map((poster, index) => (
              <PosterImage
                key={`${poster.name}-${index}`}
                name={poster.name}
                posterPath={poster.posterPath}
                className={`${posterFrame} w-24 ring-1 ring-white/10 ${index === 1 ? "z-10 w-28" : "opacity-90"}`}
                sizes="112px"
                priority
              />
            ))}
          </div>
        ) : null}
        <div className="space-y-2">
          <p className="inline-flex items-center gap-2 text-sm text-fog">
            <PersonAvatar person={{ id: list.ownerId, name: list.ownerName }} size={28} />
            {list.ownerName?.trim() || "Alguien"} te invita a
          </p>
          <h1 className="font-serif text-[2.25rem] leading-[1.05] tracking-[-0.02em] text-paper">{list.name}</h1>
          <p className="text-sm text-fog">{filmsLabel(list.total)}</p>
          <p className="text-sm font-medium text-accent">{roleLine(invite.role)}</p>
        </div>
        <JoinListActions
          token={token}
          ownerFirstName={personFirstName(list.ownerName)}
          listName={list.name}
          signedInAs={user ? (user.name?.trim() || user.email) : null}
          callbackPath={callback}
          initiallyPending={pending}
        />
      </section>
    </SharePage>
  );
}
