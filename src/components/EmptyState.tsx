import Link from "next/link";
import { btnPrimary } from "@/lib/ui";

type EmptyStateProps = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export const EmptyState = ({
  title,
  description,
  actionHref,
  actionLabel,
}: EmptyStateProps) => {
  return (
    <div className="rounded-md border border-dashed border-chrome bg-well/70 px-6 py-14 text-center">
      <p className="font-serif text-2xl text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fog">
        {description}
      </p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className={`${btnPrimary} mt-6`}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
};
