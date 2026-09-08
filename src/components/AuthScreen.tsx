import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/cn";
import { eyebrowClass } from "@/lib/ui";

type AuthScreenProps = {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export const AuthScreen = ({
  title,
  eyebrow = "CINE. HISTORIAS. EMOCIONES.",
  children,
  footer,
}: AuthScreenProps) => (
  <div className="min-h-[80vh] bg-[radial-gradient(ellipse_at_top,_rgba(124,156,255,0.22)_0%,_transparent_58%)]">
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md items-center px-4 py-12">
      <div className="w-full space-y-6 rounded-3xl border border-line bg-surface p-7 shadow-[var(--sheet-shadow)]">
        <div className="space-y-3 text-center">
          <Logo size="lg" className="justify-center" />
          <h1 className="sr-only">{title}</h1>
          {eyebrow ? <p className={cn(eyebrowClass, "text-mist")}>{eyebrow}</p> : null}
        </div>
        {children}
        {footer}
      </div>
    </div>
  </div>
);
