import { posterTone } from "@/lib/labels";
import { cn } from "@/lib/cn";

type PosterPlaceholderProps = {
  name: string;
  className?: string;
};

export const PosterPlaceholder = ({ name, className }: PosterPlaceholderProps) => {
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex aspect-[2/3] w-full items-end bg-gradient-to-br p-3 rounded-poster",
        posterTone(name),
        className,
      )}
    >
      <span className="font-serif text-4xl leading-none text-white/90">{initial}</span>
    </div>
  );
};
