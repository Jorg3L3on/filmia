type UnionToIntersection<U> = (U extends unknown ? (member: U) => void : never) extends (
  member: infer I,
) => void
  ? I
  : never;

type HandlerSet<E> = Partial<Record<string, ((event: E) => void) | undefined>>;

type ComposedKeys<Sets extends unknown[]> = keyof UnionToIntersection<Sets[number]> & string;

/**
 * Merge several handler sets ({ onPointerDown, onPointerMove, … }) into one whose every
 * handler calls each set's handler of that name, in order. Spreading two sets onto a
 * JSX element keeps only the last one per prop (FIL-I24-1: the ficha's long-press
 * silently shadowed its swipe); composing keeps both listening.
 */
export const composeHandlers = <E, Sets extends HandlerSet<E>[]>(
  ...sets: Sets
): Record<ComposedKeys<Sets>, (event: E) => void> => {
  const names = new Set<string>();
  for (const set of sets) {
    for (const name of Object.keys(set)) {
      if (typeof set[name] === "function") {
        names.add(name);
      }
    }
  }

  const composed = {} as Record<string, (event: E) => void>;
  for (const name of names) {
    composed[name] = (event: E) => {
      for (const set of sets) {
        set[name]?.(event);
      }
    };
  }
  return composed as Record<ComposedKeys<Sets>, (event: E) => void>;
};
