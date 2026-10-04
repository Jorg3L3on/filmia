"use client";

import { useRouter } from "next/navigation";
import { useTransition, type MouseEvent } from "react";
import { Button } from "@/components/Button";
import { actionErrorMessage } from "@/lib/use-optimistic-action";
import type { ButtonSize, ButtonVariant } from "@/lib/ui";

type ConfirmSubmitProps = {
  label: string;
  confirmMessage: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  href?: string;
  action?: () => Promise<unknown>;
};

export const ConfirmSubmit = ({
  label,
  confirmMessage,
  variant = "danger",
  size = "md",
  className,
  href,
  action,
}: ConfirmSubmitProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(confirmMessage)) {
      event.preventDefault();
      return;
    }

    if (!action) {
      return;
    }

    event.preventDefault();
    if (href) {
      router.push(href);
    }
    startTransition(async () => {
      try {
        await action();
      } catch (caught) {
        if (!href) {
          window.alert(actionErrorMessage(caught));
        }
      }
    });
  };

  return (
    <Button
      type={action ? "button" : "submit"}
      variant={variant}
      size={size}
      onClick={handleClick}
      pending={isPending && !href}
      pendingLabel={`${label}…`}
      className={className}
      aria-label={label}
    >
      {label}
    </Button>
  );
};
