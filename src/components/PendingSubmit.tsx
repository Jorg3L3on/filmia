"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/Button";
import type { ButtonSize, ButtonVariant } from "@/lib/ui";

type PendingSubmitProps = {
  idleLabel: string;
  pendingLabel: string;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const PendingSubmit = ({
  idleLabel,
  pendingLabel,
  className,
  variant = "primary",
  size = "md",
}: PendingSubmitProps) => {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      pending={pending}
      pendingLabel={pendingLabel}
      className={className}
    >
      {idleLabel}
    </Button>
  );
};
