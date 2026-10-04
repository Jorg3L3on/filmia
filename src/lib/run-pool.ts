/** Runs `worker` over `items` with at most `concurrency` in flight. */
export const runPool = async <T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) => {
  if (items.length === 0) {
    return;
  }

  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item !== undefined) {
        await worker(item);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
  );
};
