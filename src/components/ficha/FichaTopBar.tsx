"use client";

import { useEffect, useState } from "react";
import { BackButton } from "@/components/BackButton";

const COLLAPSE_AFTER_PX = 140;

/**
 * Dirección A: no global header on a phone, so «‹ origen» floats on the
 * backdrop over a progressive blur. Scrolling down folds it to the disc,
 * scrolling up opens it again (Morphing Button / the Shop back-button spell).
 * On desktop it sits in the flow above the hero.
 */
export const FichaTopBar = () => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        if (y < COLLAPSE_AFTER_PX) {
          setCollapsed(false);
        } else if (Math.abs(y - lastY) > 6) {
          setCollapsed(y > lastY);
        }
        lastY = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <div className="ficha-topbar">
      <div className="ficha-topbar-blur" aria-hidden="true" />
      <BackButton collapsed={collapsed} />
    </div>
  );
};
