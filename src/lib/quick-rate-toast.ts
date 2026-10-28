import { quickRateWatched, undoQuickRate } from "@/app/actions/watchlist";
import { showToast, updateToast } from "@/lib/toast";
import { showActionError, TOAST_COPY } from "@/lib/toast-alerts";

/** Provisional copy (FIL-28); «Me gustó / No tanto» are the ¿Las viste? words (FIL-I26-3). */
export const QUICK_RATE_COPY = {
  liked: "Me gustó",
  meh: "No tanto",
  likedDone: "Anotado: te gustó",
  mehDone: "Anotado: no tanto",
} as const;

let nextKey = 0;

/**
 * «Añadida a tu diario». Without stars of the person's own (`rated: false`) it also offers «Me
 * gustó / No tanto»: one tap writes the engine's implied rating (8 / 4), the title changes to
 * «Anotado: …» and Deshacer (when given) also takes the answer back.
 */
export const showDiaryToast = ({
  titleId,
  description,
  poster,
  rated,
  onUndo,
}: {
  /** The Title id, or a recommendation's catalog id before «Vi esto» created the Title. */
  titleId: string;
  description: string;
  poster?: string;
  rated: boolean;
  onUndo?: () => void;
}) => {
  nextKey += 1;
  const key = `diario:${titleId}:${nextKey}`;
  let saved: Promise<{ titleId: string; previous: number | null } | null> | null = null;

  const choose = (answer: "liked" | "meh") => {
    updateToast(key, { title: answer === "liked" ? QUICK_RATE_COPY.likedDone : QUICK_RATE_COPY.mehDone, choices: [] });
    saved = quickRateWatched(titleId, answer)
      .then((result) => (result.written ? { titleId: result.titleId ?? titleId, previous: result.previous } : null))
      .catch(() => {
        showActionError({ title: TOAST_COPY.couldNotSave, description, poster });
        return null;
      });
  };

  showToast({
    key,
    title: TOAST_COPY.addedDiary,
    description,
    poster,
    choices: rated
      ? undefined
      : [
          { label: QUICK_RATE_COPY.liked, onChoose: () => choose("liked") },
          { label: QUICK_RATE_COPY.meh, onChoose: () => choose("meh") },
        ],
    action: onUndo
      ? {
          label: "Deshacer",
          onClick: () => {
            const answered = saved;
            if (answered) {
              void answered.then((written) => (written ? undoQuickRate(written.titleId, written.previous) : undefined)).catch(() => undefined);
            }
            onUndo();
          },
        }
      : undefined,
  });
};
