"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

export const WINDOW_VIRTUALIZE_AFTER = 24;

type WindowVirtualListProps<T> = {
  items: T[];
  estimateHeight: number;
  overscan?: number;
  className?: string;
  renderItem: (item: T, index: number) => ReactNode;
  itemKey: (item: T, index: number) => string;
};

export const WindowVirtualList = <T,>({
  items,
  estimateHeight,
  overscan = 8,
  className,
  renderItem,
  itemKey,
}: WindowVirtualListProps<T>) => {
  const rootRef = useRef<HTMLUListElement>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(() => Math.min(items.length, overscan * 3));

  useEffect(() => {
    const update = () => {
      const root = rootRef.current;
      if (!root) {
        return;
      }

      const rect = root.getBoundingClientRect();
      const top = Math.max(0, -rect.top);
      const nextStart = Math.max(0, Math.floor(top / estimateHeight) - overscan);
      const visible = Math.ceil(window.innerHeight / estimateHeight) + overscan * 2;
      const nextEnd = Math.min(items.length, nextStart + visible);
      setStart(nextStart);
      setEnd(nextEnd);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [estimateHeight, items.length, overscan]);

  const topPad = start * estimateHeight;
  const bottomPad = Math.max(0, (items.length - end) * estimateHeight);

  return (
    <ul ref={rootRef} className={className}>
      {topPad > 0 ? (
        <li style={{ height: topPad }} aria-hidden="true" className="list-none p-0" />
      ) : null}
      {items.slice(start, end).map((item, index) => (
        <Fragment key={itemKey(item, start + index)}>
          {renderItem(item, start + index)}
        </Fragment>
      ))}
      {bottomPad > 0 ? (
        <li style={{ height: bottomPad }} aria-hidden="true" className="list-none p-0" />
      ) : null}
    </ul>
  );
};
