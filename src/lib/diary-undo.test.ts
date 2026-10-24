import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import {
  DIARY_REMOVED_TITLE,
  DIARY_UNDO_FAILED,
  DIARY_UNDO_LABEL,
  DIARY_UNDO_MS,
  PendingSaveError,
  chainDiaryUndo,
  clearAfterPendingSave,
  showDiaryRemovedToast,
} from "@/lib/diary-undo";
import { dismissToast, getToasts } from "@/lib/toast";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const dismissDiary = () => {
  for (const item of getToasts()) {
    if (item.title === DIARY_REMOVED_TITLE || item.title === DIARY_UNDO_FAILED) {
      dismissToast(item.id);
    }
  }
};

describe("Quitar del diario undo", { concurrency: 1 }, () => {
  it("shows Deshacer for 7s before the clear finishes, and restores only after it", async () => {
    dismissDiary();
    const order: string[] = [];
    let release!: () => void;
    const clear = new Promise<void>((resolve) => {
      release = () => {
        order.push("clear");
        resolve();
      };
    });
    let undone = 0;

    showDiaryRemovedToast({
      clear,
      restore: async () => {
        order.push("restore");
      },
      onUndo: () => {
        undone += 1;
        order.push("undo");
      },
    });

    const toast = getToasts().find((item) => item.title === DIARY_REMOVED_TITLE);
    assert.ok(toast);
    assert.equal(toast.durationMs, DIARY_UNDO_MS);
    assert.equal(DIARY_UNDO_MS, 7000);
    assert.equal(toast.action?.label, DIARY_UNDO_LABEL);
    assert.deepEqual(order, []);

    toast.action?.onClick();
    assert.equal(undone, 1);
    assert.deepEqual(order, ["undo"]);

    release();
    await flush();
    assert.deepEqual(order, ["undo", "clear", "restore"]);
    dismissDiary();
  });

  it("does not restore or toast an undo error when the clear failed", async () => {
    dismissDiary();
    let release!: (error: Error) => void;
    const clear = new Promise<void>((_resolve, reject) => {
      release = reject;
    });
    let restored = 0;
    let failed = 0;

    showDiaryRemovedToast({
      clear,
      restore: async () => {
        restored += 1;
      },
      onUndoFailed: () => {
        failed += 1;
      },
    });
    getToasts().find((item) => item.title === DIARY_REMOVED_TITLE)?.action?.onClick();
    release(new Error("No se pudo quitar."));
    await flush();
    assert.equal(restored, 0);
    assert.equal(failed, 0);
    assert.equal(getToasts().some((item) => item.title === DIARY_UNDO_FAILED), false);
    assert.equal(getToasts().some((item) => item.title === DIARY_REMOVED_TITLE), false);
    dismissDiary();
  });

  it("drops the Deshacer toast when the clear fails, and still showed it first", async () => {
    dismissDiary();
    let release!: (error: Error) => void;
    const clear = new Promise<void>((_resolve, reject) => {
      release = reject;
    });
    showDiaryRemovedToast({
      clear,
      restore: async () => {
        throw new Error("no debería restaurar");
      },
    });
    assert.equal(getToasts().some((item) => item.title === DIARY_REMOVED_TITLE), true);
    release(new Error("No se pudo quitar."));
    await flush();
    assert.equal(getToasts().some((item) => item.title === DIARY_REMOVED_TITLE), false);
    dismissDiary();
  });

  it("clears only after the in-flight mark, and skips the clear when that mark fails", async () => {
    const order: string[] = [];
    let release!: () => void;
    const save = new Promise<void>((resolve) => {
      release = resolve;
    });
    const clear = clearAfterPendingSave(save, async () => {
      order.push("clear");
    });
    assert.deepEqual(order, []);
    release();
    await clear;
    assert.deepEqual(order, ["clear"]);

    let skipped = 0;
    await assert.rejects(
      clearAfterPendingSave(Promise.reject(new Error("guardar")), async () => {
        skipped += 1;
      }),
      PendingSaveError,
    );
    assert.equal(skipped, 0);
    assert.deepEqual(order, ["clear"]);
  });

  it("toasts when the restore itself fails", async () => {
    dismissDiary();
    let failed = 0;
    const result = chainDiaryUndo(Promise.resolve(), async () => {
      throw new Error("Título no encontrado.");
    });
    showDiaryRemovedToast({
      clear: Promise.resolve(),
      restore: async () => {
        throw new Error("Título no encontrado.");
      },
      onUndoFailed: () => {
        failed += 1;
      },
    });
    getToasts().find((item) => item.title === DIARY_REMOVED_TITLE)?.action?.onClick();
    await assert.rejects(result);
    await flush();
    assert.equal(failed, 1);
    assert.equal(getToasts().some((item) => item.title === DIARY_UNDO_FAILED && item.variant === "error"), true);
    dismissDiary();
  });

  it("wires the toast through the three diary controls", async () => {
    const files = [
      "src/components/FichaWatchedSection.tsx",
      "src/components/MarkWatchedForm.tsx",
      "src/components/TitleFichaActions.tsx",
    ];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      assert.match(source, /showDiaryRemovedToast/);
      assert.match(source, /restoreTitleWatched/);
      assert.doesNotMatch(source, /ConfirmSubmit/);
      assert.doesNotMatch(source, /Quitada del diario/);
    }
    const actions = await readFile("src/components/TitleFichaActions.tsx", "utf8");
    assert.match(actions, /watchedAt\?: string \| null/);
    assert.match(actions, /clearAfterPendingSave/);
    assert.match(actions, /No se puede quitar todavía/);
    const sheet = await readFile("src/components/MarkWatchedSheet.tsx", "utf8");
    assert.match(sheet, /onSaved\?\.\(watchedAt\)/);
    const caller = await readFile("src/app/titulos/[id]/title-sections.tsx", "utf8");
    assert.match(caller, /watchedAt=\{title\.watchedAt \? toDateInput\(title\.watchedAt\) : null\}/);
  });
});
