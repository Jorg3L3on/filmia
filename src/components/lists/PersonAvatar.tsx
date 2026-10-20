import { cn } from "@/lib/cn";
import { personHue, personInitials } from "@/lib/person-avatar";

type Person = { id: string | null; name: string | null };

/** Initials on a gradient with a fixed hue per person (canvas «Avatar de quien agregó»). */
export const PersonAvatar = ({
  person,
  size = 28,
  className,
}: {
  person: Person;
  size?: 20 | 28 | 36 | 44;
  className?: string;
}) => {
  const hue = person.id ? personHue(person.id) : 220;
  return (
    <span
      title={person.name ?? undefined}
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ring-2 ring-canvas",
        size === 20 ? "text-[8px]" : size === 28 ? "text-[10px]" : size === 36 ? "text-xs" : "text-sm",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundImage: person.id
          ? `linear-gradient(135deg, hsl(${hue} 62% 52%), hsl(${(hue + 40) % 360} 58% 38%))`
          : "linear-gradient(135deg, #4b5563, #374151)",
      }}
    >
      {person.id ? personInitials(person.name) : "–"}
    </span>
  );
};

/** Members stack: 28 px, −8 px overlap; more than 4 shows 3 and «+N». */
export const AvatarStack = ({ people, className }: { people: Person[]; className?: string }) => {
  const shown = people.length > 4 ? people.slice(0, 3) : people;
  const rest = people.length - shown.length;
  return (
    <span className={cn("inline-flex items-center", className)}>
      {shown.map((person, index) => (
        <PersonAvatar key={person.id ?? index} person={person} className={index > 0 ? "-ml-2" : undefined} />
      ))}
      {rest > 0 ? (
        <span className="-ml-2 inline-flex size-7 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-paper ring-2 ring-canvas">
          +{rest}
        </span>
      ) : null}
    </span>
  );
};
