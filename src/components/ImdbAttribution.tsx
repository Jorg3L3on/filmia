import { cn } from "@/lib/cn";

/** IMDb's required credit (FIL-I35-4) for the ratings and votes taken from its datasets. */
export const IMDB_ATTRIBUTION = "Information courtesy of IMDb (https://www.imdb.com). Used with permission.";

/** Same quiet line as the JustWatch credit under «Dónde verla». */
export const ImdbAttribution = ({ className }: { className?: string }) => (
  <p className={cn("text-[10px] text-faint", className)}>
    Information courtesy of IMDb (
    <a
      href="https://www.imdb.com"
      target="_blank"
      rel="noopener noreferrer"
      className="underline-offset-2 hover:text-fog hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      https://www.imdb.com
    </a>
    ). Used with permission.
  </p>
);
