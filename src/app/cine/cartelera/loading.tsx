import { CarteleraSkeleton } from "@/components/cine/CineSkeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <CarteleraSkeleton />
    </div>
  );
}
