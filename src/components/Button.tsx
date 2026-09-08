import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "@/lib/ui";

type ButtonShared = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
  pendingLabel?: string;
  className?: string;
  children: ReactNode;
};

type NativeButtonProps = ButtonShared &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type LinkButtonProps = ButtonShared &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href"> & {
    href: string;
  };

export type ButtonProps = NativeButtonProps | LinkButtonProps;

export const Button = (props: ButtonProps) => {
  if (typeof props.href === "string") {
    const {
      href,
      variant = "primary",
      size = "md",
      pending = false,
      pendingLabel,
      className,
      children,
      ...linkProps
    } = props;
    const content = pending && pendingLabel ? pendingLabel : children;

    return (
      <Link
        href={href}
        className={buttonClass({ variant, size, pending, className })}
        aria-disabled={pending || undefined}
        {...linkProps}
      >
        {content}
      </Link>
    );
  }

  const {
    variant = "primary",
    size = "md",
    pending = false,
    pendingLabel,
    className,
    children,
    disabled,
    type = "button",
    ...buttonProps
  } = props;
  const content = pending && pendingLabel ? pendingLabel : children;

  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClass({ variant, size, pending, className })}
      {...buttonProps}
    >
      {content}
    </button>
  );
};
