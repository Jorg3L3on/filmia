import { SegmentedTabs } from "@/components/SegmentedTabs";
import { diaryModeHref, type DiaryMode } from "@/lib/diary-picks";

type DiaryModeToggleProps = {
  mode: DiaryMode;
};

const MODES = [
  { key: "picks", href: diaryModeHref("picks"), label: "Qué ver" },
  { key: "historial", href: diaryModeHref("historial"), label: "Historial" },
] satisfies Array<{ key: DiaryMode; href: string; label: string }>;

export const DiaryModeToggle = ({ mode }: DiaryModeToggleProps) => (
  <SegmentedTabs
    items={MODES}
    activeKey={mode}
    aria-label="Modo del diario"
    className="diario-mode-toggle mx-auto w-full max-w-xs sm:max-w-sm"
  />
);
