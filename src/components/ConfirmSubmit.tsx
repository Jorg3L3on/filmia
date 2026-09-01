"use client";

import type { MouseEvent } from "react";

type ConfirmSubmitProps = {
  label: string;
  confirmMessage: string;
  className?: string;
};

export const ConfirmSubmit = ({
  label,
  confirmMessage,
  className,
}: ConfirmSubmitProps) => {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  };

  return (
    <button
      type="submit"
      onClick={handleClick}
      className={className}
      aria-label={label}
    >
      {label}
    </button>
  );
};
