import Link from "next/link";
import { cn } from "@/lib/cn";
import { tagHref } from "@/lib/tags";
import { focusRing } from "@/lib/ui";

type TagPillsProps = {
  tags: Array<{ id: string; name: string; slug?: string }>;
  compact?: boolean;
  asLinks?: boolean;
};

export const TagPills = ({
  tags,
  compact = false,
  asLinks = true,
}: TagPillsProps) => {
  if (tags.length === 0) {
    return null;
  }

  const pillClass = compact
    ? "rounded-full bg-chrome px-1.5 py-0.5 text-[10px] text-fog"
    : "rounded-full bg-chrome px-2 py-0.5 text-xs text-fog";

  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const canLink = asLinks && Boolean(tag.slug);

        return (
          <li key={tag.id}>
            {canLink && tag.slug ? (
              <Link
                href={tagHref(tag.slug)}
                className={cn(
                  pillClass,
                  "transition hover:bg-accent hover:text-ink",
                  focusRing,
                )}
              >
                {tag.name}
              </Link>
            ) : (
              <span className={pillClass}>{tag.name}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
};
