import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  openOverlaySession,
  resetOverlaySessionForTests,
  type OverlayEnv,
  type OverlayPanel,
} from "@/lib/overlay-session";

type FakeEl = {
  name: string;
  disabled: boolean;
  isConnected: boolean;
  children: FakeEl[];
  focusCount: number;
  style: {
    overflow: string;
    props: Record<string, string>;
    setProperty: (property: string, value: string) => void;
    removeProperty: (property: string) => string;
  };
  focus: (options?: { preventScroll?: boolean }) => void;
  contains: (node: Node | null) => boolean;
  getClientRects: () => { length: number };
  querySelectorAll: (selectors: string) => FakeEl[];
};

const createHarness = () => {
  let active: FakeEl | null = null;
  const frames: Array<() => void> = [];
  const listeners = new Set<(event: KeyboardEvent) => void>();

  const makeStyle = (overflow = "auto") => {
    const props: Record<string, string> = {};
    return {
      overflow,
      props,
      setProperty: (property: string, value: string) => {
        props[property] = value;
      },
      removeProperty: (property: string) => {
        const previous = props[property] ?? "";
        delete props[property];
        return previous;
      },
    };
  };

  const el = (name: string, children: FakeEl[] = []): FakeEl => {
    const node: FakeEl = {
      name,
      disabled: false,
      isConnected: true,
      children,
      focusCount: 0,
      style: makeStyle(),
      focus: () => {
        node.focusCount += 1;
        active = node;
      },
      contains: (other) => {
        if (other === (node as unknown as Node)) return true;
        return node.children.some((child) => child.contains(other));
      },
      getClientRects: () => ({ length: node.disabled ? 0 : 1 }),
      querySelectorAll: () => {
        const found: FakeEl[] = [];
        const walk = (current: FakeEl) => {
          for (const child of current.children) {
            if (!child.disabled) found.push(child);
            walk(child);
          }
        };
        walk(node);
        return found;
      },
    };
    for (const child of children) {
      child.children = child.children;
    }
    return node;
  };

  const html = el("html");
  const body = el("body");
  const env: OverlayEnv = {
    document: {
      documentElement: html,
      body,
      get activeElement() {
        return active;
      },
    },
    window: {
      addEventListener: (_type, listener) => {
        listeners.add(listener);
      },
      removeEventListener: (_type, listener) => {
        listeners.delete(listener);
      },
      requestAnimationFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      },
      cancelAnimationFrame: () => {
        frames.length = 0;
      },
      innerHeight: 800,
      visualViewport: null,
    },
  };

  const flush = () => {
    const pending = frames.splice(0);
    for (const frame of pending) frame();
  };

  const key = (name: string, shiftKey = false) => {
    let prevented = false;
    const event = {
      key: name,
      shiftKey,
      preventDefault: () => {
        prevented = true;
      },
    } as KeyboardEvent;
    for (const listener of listeners) listener(event);
    return prevented;
  };

  return { el, env, html, body, flush, key, get active() { return active; }, setActive: (node: FakeEl | null) => { active = node; } };
};

describe("confirm dialog overlay", { concurrency: 1 }, () => {
  beforeEach(() => {
    resetOverlaySessionForTests();
  });

  it("focuses Cancel, traps Tab, cancels on Escape, and returns focus to the trigger", () => {
    const harness = createHarness();
    const trigger = harness.el("trigger");
    const cancel = harness.el("cancel");
    const confirm = harness.el("confirm");
    const panel = harness.el("panel", [cancel, confirm]);
    harness.setActive(trigger);
    let closed = 0;

    const release = openOverlaySession({
      panel: () => panel as unknown as OverlayPanel,
      onClose: () => {
        closed += 1;
      },
      initialFocus: () => cancel,
      env: harness.env,
    });

    assert.equal(harness.html.style.overflow, "hidden");
    assert.equal(harness.body.style.overflow, "hidden");
    harness.flush();
    assert.equal(harness.active, cancel);
    assert.equal(cancel.focusCount, 1);
    assert.equal(panel.focusCount, 0);

    harness.setActive(confirm);
    assert.equal(harness.key("Tab"), true);
    assert.equal(harness.active, cancel);

    assert.equal(harness.key("Tab", true), true);
    assert.equal(harness.active, confirm);

    assert.equal(harness.key("Escape"), true);
    assert.equal(closed, 1);

    release();
    assert.equal(harness.active, trigger);
    assert.equal(trigger.focusCount, 1);
    assert.equal(harness.html.style.overflow, "auto");
    assert.equal(harness.body.style.overflow, "auto");
  });

  it("lets only the top layer hear Escape, and keeps the scroll lock until the last one closes", () => {
    const harness = createHarness();
    const trigger = harness.el("trigger");
    harness.setActive(trigger);
    const lowerPanel = harness.el("lower", [harness.el("lower-cancel")]);
    const upperPanel = harness.el("upper", [harness.el("upper-cancel")]);
    let lower = 0;
    let upper = 0;

    const releaseLower = openOverlaySession({
      panel: () => lowerPanel as unknown as OverlayPanel,
      onClose: () => {
        lower += 1;
      },
      env: harness.env,
    });
    harness.flush();
    const releaseUpper = openOverlaySession({
      panel: () => upperPanel as unknown as OverlayPanel,
      onClose: () => {
        upper += 1;
      },
      initialFocus: () => upperPanel.children[0],
      env: harness.env,
    });
    harness.flush();

    harness.key("Escape");
    assert.equal(upper, 1);
    assert.equal(lower, 0);
    assert.equal(harness.html.style.overflow, "hidden");

    releaseUpper();
    harness.key("Escape");
    assert.equal(lower, 1);
    assert.equal(harness.html.style.overflow, "hidden");

    releaseLower();
    assert.equal(harness.html.style.overflow, "auto");
  });
});
