import Image from "next/image";
import { cn } from "@/lib/cn";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  showMark?: boolean;
  showWordmark?: boolean;
  className?: string;
};

const sizeMap = {
  sm: { image: 28, wordmark: "text-xl" },
  md: { image: 36, wordmark: "text-2xl" },
  lg: { image: 48, wordmark: "text-3xl" },
} as const;

export const Logo = ({
  size = "md",
  showMark = true,
  showWordmark = true,
  className,
}: LogoProps) => {
  const { image, wordmark } = sizeMap[size];

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {showMark ? (
        <Image
          src="/filmia-mark.png"
          alt=""
          width={image}
          height={image}
          className="shrink-0"
          priority
        />
      ) : null}
      {showWordmark ? (
        <span className={cn("font-serif tracking-wide text-paper", wordmark)}>
          Film<span className="text-accent">ia</span>
        </span>
      ) : null}
    </span>
  );
};
