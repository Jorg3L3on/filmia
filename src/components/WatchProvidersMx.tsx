import Image from "next/image";
import type { WatchProviderOffer, WatchProvidersMxData } from "@/lib/watch-providers";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

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
};

const ProviderSection = ({ label, providers, link }: ProviderSectionProps) => {
  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fog">
        {label}
      </p>
      <ul className="flex flex-wrap gap-2">
        {providers.map((provider) => (
          <li key={`${label}-${provider.providerId}`}>
            {link ? (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-2 rounded-sm border border-chrome bg-surface px-2.5 py-1.5 text-sm text-paper transition hover:border-accent/40 hover:text-white",
                  focusRing,
                )}
                aria-label={`${provider.name} en ${label.toLowerCase()}`}
              >
                <ProviderLogo provider={provider} />
                <span>{provider.name}</span>
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-sm border border-chrome bg-surface px-2.5 py-1.5 text-sm text-paper">
                <ProviderLogo provider={provider} />
                <span>{provider.name}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

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
};

export const WatchProvidersMx = ({ data }: WatchProvidersMxProps) => {
  const hasData =
    data &&
    (data.flatrate.length > 0 || data.rent.length > 0 || data.buy.length > 0);

  return (
    <section
      className="space-y-3 rounded-md border border-line bg-well/60 p-4"
      aria-labelledby="watch-providers-heading"
    >
      <div className="space-y-1">
        <h2
          id="watch-providers-heading"
          className="text-sm font-semibold uppercase tracking-[0.18em] text-accent"
        >
          Dónde ver
        </h2>
        <p className="text-xs text-mist">Disponibilidad en México</p>
      </div>

      {!hasData ? (
        <p className="text-sm text-fog">No hay datos de streaming en MX.</p>
      ) : (
        <div className="space-y-4">
          <ProviderSection label="Incluido" providers={data.flatrate} link={data.link} />
          <ProviderSection label="Rentar" providers={data.rent} link={data.link} />
          <ProviderSection label="Comprar" providers={data.buy} link={data.link} />
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
