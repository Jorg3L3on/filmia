import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Para ti",
} as const;

/** Para ti (FIL-I60): discover what to watch outside your lists. */
export default async function ParaTiPage() {
  await requireUserId();
  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="font-serif text-4xl leading-tight tracking-tight text-paper md:text-[2.75rem]">
        ¿Qué se te antoja?
      </h1>
    </div>
  );
}
