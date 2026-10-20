import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampGroupMaxUses,
  draftInvite,
  generateInviteToken,
  hashInviteToken,
  inviteStatus,
  inviteUsable,
  isPlausibleInviteToken,
  nextJoinRequestStatus,
  PERSONAL_INVITE_TTL_MS,
} from "./list-invites-core";

const NOW = new Date("2026-10-20T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("invite tokens", () => {
  it("are 43 url-safe characters and never repeat", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateInviteToken));
    assert.equal(tokens.size, 200);
    for (const token of tokens) {
      assert.equal(isPlausibleInviteToken(token), true);
    }
  });

  it("are stored only as a sha256", () => {
    const token = generateInviteToken();
    const hash = hashInviteToken(token);
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.notEqual(hash, token);
    assert.equal(hashInviteToken(token), hash);
  });

  it("rejects anything that is not a token shape", () => {
    assert.equal(isPlausibleInviteToken(""), false);
    assert.equal(isPlausibleInviteToken("../../etc"), false);
    assert.equal(isPlausibleInviteToken("a".repeat(44)), false);
  });
});

describe("draftInvite", () => {
  it("personal: one use, 7 days", () => {
    const draft = draftInvite("PERSONAL", "EDITOR", 12, NOW);
    assert.equal(draft.maxUses, 1);
    assert.equal(draft.expiresAt?.getTime(), NOW.getTime() + PERSONAL_INVITE_TTL_MS);
  });

  it("group: 2 to 20 uses, 5 by default, no expiry", () => {
    assert.equal(draftInvite("GROUP", "VIEWER", undefined, NOW).maxUses, 5);
    assert.equal(draftInvite("GROUP", "VIEWER", 1, NOW).maxUses, 2);
    assert.equal(draftInvite("GROUP", "VIEWER", 99, NOW).maxUses, 20);
    assert.equal(draftInvite("GROUP", "VIEWER", "8", NOW).maxUses, 8);
    assert.equal(draftInvite("GROUP", "VIEWER", 8, NOW).expiresAt, null);
    assert.equal(clampGroupMaxUses("nope"), 5);
  });
});

describe("inviteUsable", () => {
  const personal = { expiresAt: new Date(NOW.getTime() + 7 * DAY), maxUses: 1, usedCount: 0, disabledAt: null };

  it("a fresh personal link works once", () => {
    assert.equal(inviteUsable(personal, NOW), true);
    assert.equal(inviteUsable({ ...personal, usedCount: 1 }, NOW), false);
  });

  it("a personal link fails after 7 days", () => {
    assert.equal(inviteUsable(personal, new Date(NOW.getTime() + 7 * DAY)), false);
    assert.equal(inviteUsable(personal, new Date(NOW.getTime() + 7 * DAY - 1)), true);
  });

  it("a group link fails at maxUses or when switched off", () => {
    const group = { expiresAt: null, maxUses: 3, usedCount: 2, disabledAt: null };
    assert.equal(inviteUsable(group, NOW), true);
    assert.equal(inviteUsable({ ...group, usedCount: 3 }, NOW), false);
    assert.equal(inviteUsable({ ...group, disabledAt: NOW }, NOW), false);
  });

  it("no link at all reads the same as a dead one", () => {
    assert.equal(inviteUsable(null, NOW), false);
    assert.equal(inviteUsable(undefined, NOW), false);
  });

  it("tells the owner why a link stopped", () => {
    assert.equal(inviteStatus(personal, NOW), "active");
    assert.equal(inviteStatus({ ...personal, usedCount: 1 }, NOW), "used");
    assert.equal(inviteStatus({ ...personal, disabledAt: NOW }, NOW), "off");
    assert.equal(inviteStatus(personal, new Date(NOW.getTime() + 8 * DAY)), "expired");
  });
});

describe("nextJoinRequestStatus", () => {
  it("only a pending request moves", () => {
    assert.equal(nextJoinRequestStatus("PENDING", "approve"), "APPROVED");
    assert.equal(nextJoinRequestStatus("PENDING", "reject"), "REJECTED");
    assert.equal(nextJoinRequestStatus("PENDING", "cancel"), "CANCELLED");
    assert.equal(nextJoinRequestStatus("APPROVED", "reject"), null);
    assert.equal(nextJoinRequestStatus("REJECTED", "approve"), null);
    assert.equal(nextJoinRequestStatus("CANCELLED", "approve"), null);
  });
});
