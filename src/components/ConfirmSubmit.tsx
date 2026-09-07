"use client";

import { useRouter } from "next/navigation";
import { useTransition, type MouseEvent } from "react";
import { actionErrorMessage } from "@/lib/use-optimistic-action";

type ConfirmSubmitProps = {
  label: string;
  confirmMessage: string;
  className?: string;
  href?: string;
  action?: () => Promise<unknown>;
};

export const ConfirmSubmit = ({
  label,
  confirmMessage,
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
    <button
      type={action ? "button" : "submit"}
      onClick={handleClick}
      disabled={isPending}
      className={className}
      aria-label={label}
      aria-busy={isPending}
    >
      {isPending && !href ? `${label}…` : label}
    </button>
  );
};
