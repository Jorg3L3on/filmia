import { AntojoWords } from "@/components/para-ti/AntojoWords";
import { ParaTiRoom } from "@/components/para-ti/ParaTiRoom";
import { ShelvesSkeleton } from "@/components/para-ti/ParaTiSkeletons";

/** The opening screen's real header and words (static), shelves as blocks: nothing moves when it loads. */
export default function Loading() {
  return (
    <ParaTiRoom antojo={null}>
      <div className="para-ti-opening mx-auto w-full max-w-5xl" aria-busy="true">
        <header className="para-ti-hero avatar-room">
          <p className="para-ti-eyebrow">Para ti</p>
          <p className="para-ti-question" aria-hidden="true">¿Qué se te antoja?</p>
        </header>
        <AntojoWords query="" />
        <ShelvesSkeleton />
      </div>
    </ParaTiRoom>
  );
}
