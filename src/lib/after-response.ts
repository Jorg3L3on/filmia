import { after } from "next/server";

export const scheduleAfterResponse = (task: () => Promise<void>) => {
  try {
    after(task);
  } catch {
    void task();
  }
};
