import Image from "next/image";
import { cn } from "@/lib/cn";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
};

const sizeMap = {
  sm: { image: 28, wordmark: "text-lg" },
  md: { image: 36, wordmark: "text-2xl" },
  lg: { image: 48, wordmark: "text-3xl" },
} as const;

export const Logo = ({ size = "md", showWordmark = true, className }: LogoProps) => {
  const { image, wordmark } = sizeMap[size];

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/logo.png"
        alt=""
        width={image}
        height={image}
        className="h-auto w-auto rounded-poster"
        priority
      />
      {showWordmark ? (
        <span className={cn("font-serif tracking-wide text-white", wordmark)}>
          Filmia
        </span>
      ) : null}
    </span>
  );
};
