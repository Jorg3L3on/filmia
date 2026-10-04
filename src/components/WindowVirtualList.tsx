"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { catalogGridColumnCount } from "@/lib/catalog-grid";

export const WINDOW_VIRTUALIZE_AFTER = 24;
export const LIST_GRID_ROW_ESTIMATE = 420;

export const useCatalogGridColumns = () => {
  const [columns, setColumns] = useState(2);

  useEffect(() => {
    const update = () => {
      setColumns(catalogGridColumnCount(window.innerWidth));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return columns;
};

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

  const safeStart = Math.min(start, Math.max(0, items.length));
  const safeEnd = Math.min(Math.max(end, safeStart), items.length);
  const topPad = safeStart * estimateHeight;
  const bottomPad = Math.max(0, (items.length - safeEnd) * estimateHeight);

  return (
    <ul ref={rootRef} className={className} data-virtualized="true">
      {topPad > 0 ? (
        <li style={{ height: topPad }} aria-hidden="true" className="list-none p-0" />
      ) : null}
      {items.slice(safeStart, safeEnd).map((item, index) => (
        <Fragment key={itemKey(item, safeStart + index)}>
          {renderItem(item, safeStart + index)}
        </Fragment>
      ))}
      {bottomPad > 0 ? (
        <li style={{ height: bottomPad }} aria-hidden="true" className="list-none p-0" />
      ) : null}
    </ul>
  );
};

type WindowVirtualGridProps<T> = {
  items: T[];
  columns: number;
  estimateRowHeight: number;
  overscan?: number;
  className?: string;
  renderItem: (item: T, index: number) => ReactNode;
  itemKey: (item: T, index: number) => string;
};

export const WindowVirtualGrid = <T,>({
  items,
  columns,
  estimateRowHeight,
  overscan = 2,
  className,
  renderItem,
  itemKey,
}: WindowVirtualGridProps<T>) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const safeColumns = Math.max(1, columns);
  const rowCount = Math.ceil(items.length / safeColumns);
  const [startRow, setStartRow] = useState(0);
  const [endRow, setEndRow] = useState(() => Math.min(rowCount, overscan * 3));

  useEffect(() => {
    const update = () => {
      const root = rootRef.current;
      if (!root) {
        return;
      }

      const rect = root.getBoundingClientRect();
      const top = Math.max(0, -rect.top);
      const nextStart = Math.max(0, Math.floor(top / estimateRowHeight) - overscan);
      const visible = Math.ceil(window.innerHeight / estimateRowHeight) + overscan * 2;
      const nextEnd = Math.min(rowCount, nextStart + visible);
      setStartRow(nextStart);
      setEndRow(nextEnd);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [estimateRowHeight, items.length, overscan, rowCount]);

  const safeStartRow = Math.min(startRow, Math.max(0, rowCount));
  const safeEndRow = Math.min(Math.max(endRow, safeStartRow), rowCount);
  const start = safeStartRow * safeColumns;
  const end = Math.min(items.length, safeEndRow * safeColumns);
  const topPad = safeStartRow * estimateRowHeight;
  const bottomPad = Math.max(0, (rowCount - safeEndRow) * estimateRowHeight);

  return (
    <div ref={rootRef} data-virtualized="true">
      {topPad > 0 ? (
        <div style={{ height: topPad }} aria-hidden="true" />
      ) : null}
      <ul className={className}>
        {items.slice(start, end).map((item, index) => (
          <Fragment key={itemKey(item, start + index)}>
            {renderItem(item, start + index)}
          </Fragment>
        ))}
      </ul>
      {bottomPad > 0 ? (
        <div style={{ height: bottomPad }} aria-hidden="true" />
      ) : null}
    </div>
  );
};

