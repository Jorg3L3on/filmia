"use client";

import { useFormStatus } from "react-dom";

type PendingSubmitProps = {
  idleLabel: string;
  pendingLabel: string;
  className?: string;
};

export const PendingSubmit = ({
  idleLabel,
  pendingLabel,
  className,
}: PendingSubmitProps) => {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
};
