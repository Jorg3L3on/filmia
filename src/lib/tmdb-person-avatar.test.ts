import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TmdbPersonAvatar } from "@/components/TmdbPersonAvatar";
import { AVATAR_TINTS, avatarInitials, avatarTint, avatarView } from "./tmdb-person-avatar";

describe("avatarView", () => {
  it("uses the TMDB w185 photo when there is one", () => {
    assert.deepEqual(avatarView({ personId: 1, name: "Greta Gerwig", profilePath: "/abc.jpg" }), {
      kind: "photo",
      src: "https://image.tmdb.org/t/p/w185/abc.jpg",
    });
  });

  it("falls back to the monogram without a photo", () => {
    const view = avatarView({ personId: 7, name: "Greta Gerwig", profilePath: null });
    assert.deepEqual(view, { kind: "monogram", initials: "GG", tint: avatarTint(7) });
  });

  it("falls back to the monogram when the photo failed to load", () => {
    const view = avatarView({ personId: 7, name: "Greta Gerwig", profilePath: "/abc.jpg", failed: true });
    assert.equal(view.kind, "monogram");
  });
});

describe("avatarTint", () => {
  it("gives the same tint for the same id", () => {
    assert.equal(avatarTint(138), avatarTint(138));
    assert.equal(avatarTint(6), avatarTint(0));
  });

  it("spreads ids over the six tints and folds odd ids in", () => {
    const tints = new Set([0, 1, 2, 3, 4, 5].map(avatarTint));
    assert.equal(tints.size, AVATAR_TINTS.length);
    assert.ok(AVATAR_TINTS.includes(avatarTint(-13) as (typeof AVATAR_TINTS)[number]));
    assert.ok(AVATAR_TINTS.includes(avatarTint(Number.NaN) as (typeof AVATAR_TINTS)[number]));
  });
});

describe("avatarInitials", () => {
  it("takes the first and last word", () => {
    assert.equal(avatarInitials("María Fernanda Villaseñor de la Garza"), "MG");
    assert.equal(avatarInitials("  Alfonso   Cuarón "), "AC");
  });

  it("keeps one letter for a single name and «?» for nothing", () => {
    assert.equal(avatarInitials("Zendaya"), "Z");
    assert.equal(avatarInitials("   "), "?");
    assert.equal(avatarInitials("— ·"), "?");
  });

  it("handles accents, lower case and non-Latin scripts", () => {
    assert.equal(avatarInitials("ángela de la ópera"), "ÁÓ");
    assert.equal(avatarInitials("黒澤 明"), "黒明");
    assert.equal(avatarInitials("Пак Чхан Ук"), "ПУ");
    assert.equal(avatarInitials("봉준호"), "봉");
    assert.equal(avatarInitials("(Jean-Luc) Godard"), "JG");
  });
});

describe("TmdbPersonAvatar markup", () => {
  const render = (props: Partial<Parameters<typeof TmdbPersonAvatar>[0]>) =>
    renderToStaticMarkup(
      createElement(TmdbPersonAvatar, { personId: 3, name: "Lucía Ferreyra", profilePath: "/p.jpg", size: 28, ...props }),
    );

  it("draws the photo at 28 px without ring", () => {
    const html = render({});
    assert.match(html, /data-avatar="photo"/);
    assert.match(html, /width:28px/);
    assert.doesNotMatch(html, /ring-affinity/);
  });

  it("draws the monogram at 80 px with the affinity ring", () => {
    const html = render({ profilePath: null, size: 80, ring: true });
    assert.match(html, /data-avatar="monogram"/);
    assert.match(html, />LF</);
    assert.match(html, /width:80px/);
    assert.match(html, /font-size:29px/);
    assert.match(html, /ring-affinity/);
  });

  it("draws a shimmer while loading", () => {
    assert.match(render({ loading: true }), /data-avatar="loading"[^>]*shimmer/);
  });
});
