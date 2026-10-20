import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * IDOR guard (FIL-I18-2): every server action that takes a listId reaches the
 * list through `requireListAccess` (or `listAccessFor` + `canOnList`) with the
 * level the role matrix asks for. A new action without a guard fails here.
 */

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

/** Exported `const name = async (...) => {...}` bodies, up to the next export. */
const exportedBodies = (source: string) => {
  const parts = source.split(/\nexport const /).slice(1);
  return new Map(
    parts.map((part) => {
      const name = part.slice(0, part.search(/[\s=]/));
      return [name, part] as const;
    }),
  );
};

const EXPECTED: Record<string, Record<string, string>> = {
  "src/app/actions/lists.ts": {
    updateListWithFeedback: "via saveListChanges",
    deleteList: 'requireListAccess(listId, "manage")',
    addTitleToList: 'requireListAccess(listId, "edit_items")',
    removeTitleFromList: 'requireListAccess(listId, "edit_items")',
    toggleTitleInList: 'requireListAccess(listId, "edit_items")',
    moveListItem: 'requireListAccess(listId, "edit_items")',
    reorderList: 'requireListAccess(listId, "edit_items")',
    saveTmdbTitleInLists: 'canOnList(access.role, "edit_items")',
    addTitleFromTmdbToList: "saveTmdbTitleInLists(",
    createListWithFeedback: "saveNewList(",
  },
  "src/app/actions/list-sharing.ts": {
    createInvite: 'requireListAccess(listId, "manage")',
    toggleInvite: 'requireListAccess(listId, "manage")',
    decideRequests: 'requireListAccess(listId, "manage")',
    changeMemberRole: 'requireListAccess(listId, "manage")',
    removeListMember: 'requireListAccess(listId, "manage")',
    leaveList: 'requireListAccess(listId, "read")',
    joinWithInvite: "getLiveSessionUser()",
    cancelMyRequest: "cancelJoinRequest(userId",
    dismissMyRequest: "dismissJoinOutcome(userId",
  },
};

describe("list actions are guarded", () => {
  for (const [file, expected] of Object.entries(EXPECTED)) {
    const source = read(file);
    const bodies = exportedBodies(source);

    it(`${file}: no exported action is unaccounted for`, () => {
      const actions = [...bodies.keys()].filter((name) => /^[a-z]/.test(name));
      assert.deepEqual(actions.sort(), Object.keys(expected).sort());
    });

    for (const [name, needle] of Object.entries(expected)) {
      it(`${name} checks access`, () => {
        if (needle === "via saveListChanges") {
          assert.match(source, /const saveListChanges[\s\S]*?requireListAccess\(listId, "manage"\)/);
          assert.ok(bodies.get(name)?.includes("saveListChanges("));
          return;
        }
        assert.ok(bodies.get(name)?.includes(needle), `${name} should call ${needle}`);
      });
    }
  }

  it("saveNewList only creates lists owned by the caller", () => {
    assert.match(read("src/app/actions/lists.ts"), /const saveNewList[\s\S]*?requireUserId\(\)[\s\S]*?userId,/);
  });
});
