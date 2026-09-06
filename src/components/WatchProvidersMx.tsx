import Image from "next/image";
import Link from "next/link";
import type { Platform } from "@/db";
import { cn } from "@/lib/cn";
import { isUserStreamingProvider } from "@/lib/streaming-platforms";
import { btnLink, focusRing } from "@/lib/ui";
import type { WatchProviderOffer, WatchProvidersMxData } from "@/lib/watch-providers";

type WatchProviderChipsProps = {
  providers: WatchProviderOffer[];
  max?: number;
  size?: "sm" | "md";
  className?: string;
};

export const WatchProviderChips = ({
  providers,
  max = 4,
  size = "sm",
  className = "",
}: WatchProviderChipsProps) => {
  if (providers.length === 0) {
    return null;
  }

  const visible = providers.slice(0, max);
  const overflow = providers.length - visible.length;
  const chipSize = size === "sm" ? 22 : 28;

  return (
    <div
      className={cn("flex flex-wrap items-center justify-center gap-1.5", className)}
      aria-label="Plataformas de streaming en México"
    >
      {visible.map((provider) => (
        <span
          key={provider.providerId}
          title={provider.name}
          className="inline-flex overflow-hidden rounded-sm border border-chrome/80 bg-surface"
        >
          {provider.logoUrl ? (
            <Image
              src={provider.logoUrl}
              alt={provider.name}
              width={chipSize}
              height={chipSize}
              className="object-cover"
              unoptimized
            />
          ) : (
            <span
              className={`flex items-center justify-center bg-chrome px-1.5 text-[9px] font-semibold uppercase text-paper ${size === "sm" ? "h-[22px] min-w-[22px]" : "h-[28px] min-w-[28px]"}`}
            >
              {provider.name.slice(0, 2)}
            </span>
          )}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="rounded-sm border border-chrome/80 bg-surface px-1.5 py-0.5 text-[10px] text-fog">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
};

type ProviderSectionProps = {
  label: string;
  providers: WatchProviderOffer[];
  link?: string | null;
  userPlatforms: Platform[];
};

const sortProvidersForUser = (
  providers: WatchProviderOffer[],
  userPlatforms: Platform[],
) =>
  [...providers].sort((left, right) => {
    const leftMine = isUserStreamingProvider(left, userPlatforms) ? 0 : 1;
    const rightMine = isUserStreamingProvider(right, userPlatforms) ? 0 : 1;
    return leftMine - rightMine;
  });

const ProviderSection = ({
  label,
  providers,
  link,
  userPlatforms,
}: ProviderSectionProps) => {
  if (providers.length === 0) {
    return null;
  }

  const ordered = sortProvidersForUser(providers, userPlatforms);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fog">
        {label}
      </p>
      <ul className="flex flex-wrap gap-2">
        {ordered.map((provider) => {
          const isMine = isUserStreamingProvider(provider, userPlatforms);
          const chipClass = cn(
            "inline-flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-sm transition",
            isMine
              ? "border-accent bg-accent/10 text-white"
              : "border-chrome bg-surface text-paper hover:border-accent/40 hover:text-white",
          );
          const ariaLabel = isMine
            ? `${provider.name} en ${label.toLowerCase()} (tu plataforma)`
            : `${provider.name} en ${label.toLowerCase()}`;

          return (
            <li key={`${label}-${provider.providerId}`}>
              {link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(chipClass, focusRing)}
                  aria-label={ariaLabel}
                >
                  <ProviderLogo provider={provider} />
                  <span>{provider.name}</span>
                  {isMine ? <YoursBadge /> : null}
                </a>
              ) : (
                <span className={chipClass} aria-label={ariaLabel}>
                  <ProviderLogo provider={provider} />
                  <span>{provider.name}</span>
                  {isMine ? <YoursBadge /> : null}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const YoursBadge = () => (
  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink">
    Tuya
  </span>
);

const ProviderLogo = ({ provider }: { provider: WatchProviderOffer }) => {
  if (!provider.logoUrl) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-chrome text-[10px] font-bold uppercase text-white">
        {provider.name.slice(0, 2)}
      </span>
    );
  }

  return (
    <Image
      src={provider.logoUrl}
      alt=""
      width={28}
      height={28}
      className="rounded-sm object-cover"
      unoptimized
    />
  );
};

type WatchProvidersMxProps = {
  data: WatchProvidersMxData | null;
  userPlatforms?: Platform[];
};

export const WatchProvidersMx = ({
  data,
  userPlatforms = [],
}: WatchProvidersMxProps) => {
  const hasData =
    data &&
    (data.flatrate.length > 0 || data.rent.length > 0 || data.buy.length > 0);

  return (
    <section
      className="space-y-3 rounded-md border border-line bg-well/60 p-4"
      aria-labelledby="watch-providers-heading"
    >
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h2
            id="watch-providers-heading"
            className="text-sm font-semibold uppercase tracking-[0.18em] text-accent"
          >
            Disponible en MX
          </h2>
          <p className="text-xs text-mist">Streaming en México</p>
        </div>
        {data?.link ? (
          <a
            href={data.link}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("text-xs font-medium text-accent hover:text-accent-hover", focusRing)}
          >
            Ver todas
          </a>
        ) : null}
      </div>

      {userPlatforms.length === 0 ? (
        <p className="text-sm text-fog">
          <Link href="/perfil" className={btnLink}>
            Elige tus plataformas
          </Link>{" "}
          para marcar cuáles son tuyas.
        </p>
      ) : null}

      {!hasData ? (
        <p className="text-sm text-fog">No hay datos de streaming en MX.</p>
      ) : (
        <div className="space-y-4">
          <ProviderSection
            label="Incluido"
            providers={data.flatrate}
            link={data.link}
            userPlatforms={userPlatforms}
          />
          <ProviderSection
            label="Rentar"
            providers={data.rent}
            link={data.link}
            userPlatforms={userPlatforms}
          />
          <ProviderSection
            label="Comprar"
            providers={data.buy}
            link={data.link}
            userPlatforms={userPlatforms}
          />
        </div>
      )}

      <p className="text-[10px] text-faint">
        Datos de{" "}
        <a
          href="https://www.justwatch.com/mx"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:text-fog hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          JustWatch
        </a>
      </p>
    </section>
  );
};
