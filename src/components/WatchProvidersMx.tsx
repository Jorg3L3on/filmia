import Image from "next/image";
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
      className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}
      aria-label="Plataformas de streaming en México"
    >
      {visible.map((provider) => (
        <span
          key={provider.providerId}
          title={provider.name}
          className="inline-flex overflow-hidden rounded-md border border-[#2c3440]/80 bg-[#1c2228]"
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
              className={`flex items-center justify-center bg-[#2c3440] px-1.5 text-[9px] font-semibold uppercase text-[#c8d6e5] ${size === "sm" ? "h-[22px] min-w-[22px]" : "h-[28px] min-w-[28px]"}`}
            >
              {provider.name.slice(0, 2)}
            </span>
          )}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="rounded-md border border-[#2c3440]/80 bg-[#1c2228] px-1.5 py-0.5 text-[10px] text-[#99aabb]">
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
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#99aabb]">
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
                className="inline-flex items-center gap-2 rounded-lg border border-[#2c3440] bg-[#1c2228] px-2.5 py-1.5 text-sm text-[#c8d6e5] transition hover:border-[#00e054]/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e054]"
                aria-label={`${provider.name} en ${label.toLowerCase()}`}
              >
                <ProviderLogo provider={provider} />
                <span>{provider.name}</span>
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-lg border border-[#2c3440] bg-[#1c2228] px-2.5 py-1.5 text-sm text-[#c8d6e5]">
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
      <span className="flex h-7 w-7 items-center justify-center rounded bg-[#2c3440] text-[10px] font-bold uppercase text-white">
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
      className="rounded object-cover"
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
      className="space-y-3 rounded-xl border border-[#1f262d] bg-[#0f1317]/60 p-4"
      aria-labelledby="watch-providers-heading"
    >
      <div className="space-y-1">
        <h2
          id="watch-providers-heading"
          className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00e054]"
        >
          Dónde ver
        </h2>
        <p className="text-xs text-[#678]">Disponibilidad en México</p>
      </div>

      {!hasData ? (
        <p className="text-sm text-[#99aabb]">No hay datos de streaming en MX.</p>
      ) : (
        <div className="space-y-4">
          <ProviderSection label="Incluido" providers={data.flatrate} link={data.link} />
          <ProviderSection label="Rentar" providers={data.rent} link={data.link} />
          <ProviderSection label="Comprar" providers={data.buy} link={data.link} />
        </div>
      )}

      <p className="text-[10px] text-[#556]">
        Datos de{" "}
        <a
          href="https://www.justwatch.com/mx"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:text-[#99aabb] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e054]"
        >
          JustWatch
        </a>
      </p>
    </section>
  );
};
