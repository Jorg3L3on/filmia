"use client";

import { useId, useState, type ReactNode } from "react";
import { TitleActionRow } from "@/components/TitleActionRow";
import { TitleSaveCta } from "@/components/TitleSaveCta";

type MemberList = { id: string; name: string; slug: string | null };

type TitleFichaActionsProps = {
  titleId: string;
  titleName: string;
  watched: boolean;
  inWatchlist: boolean;
  memberLists: MemberList[];
  listCount: number;
  rating: number | null;
  review: string | null;
  listsPanel: ReactNode;
};

/**
 * Ficha save CTA + chip row sharing one lists panel: «Gestionar listas» and
 * the «Lista» chip toggle the same panel, which opens under the chips.
 */
export const TitleFichaActions = ({
  titleId,
  titleName,
  watched,
  inWatchlist,
  memberLists,
  listCount,
  rating,
  review,
  listsPanel,
}: TitleFichaActionsProps) => {
  const [listsOpen, setListsOpen] = useState(false);
  const listsPanelId = useId();
  const handleToggleLists = () => setListsOpen((current) => !current);

  return (
    <>
      <TitleSaveCta
        titleId={titleId}
        inWatchlist={inWatchlist}
        memberLists={memberLists}
        listsOpen={listsOpen}
        onToggleLists={handleToggleLists}
        listsPanelId={listsPanelId}
      />
      <TitleActionRow
        titleId={titleId}
        titleName={titleName}
        watched={watched}
        inWatchlist={inWatchlist}
        listCount={listCount}
        rating={rating}
        review={review}
        listsPanel={listsPanel}
        listsOpen={listsOpen}
        onToggleLists={handleToggleLists}
        listsPanelId={listsPanelId}
      />
    </>
  );
};
