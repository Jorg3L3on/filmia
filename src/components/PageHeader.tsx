import { eyebrowClass } from "@/lib/ui";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export const PageHeader = ({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) => {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl space-y-2">
        <p className={eyebrowClass}>{eyebrow}</p>
        <h1 className="font-serif text-4xl tracking-tight text-white md:text-[2.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="text-sm leading-relaxed text-fog">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
};
