"use client";

import { useId, useState } from "react";
import { Button } from "@/components/Button";
import { BedtimeDial, nightEndsStatusCopy, useNightEndsSave } from "@/components/onboarding/BedtimeDial";
import { MoonIcon, ProfileGroup, ProfileRow, ProfileSection, WeekendMoonIcon } from "@/components/profile/ProfileRows";
import { Sheet, SheetHandle, useOpenGeneration } from "@/components/Sheet";
import type { BedtimeTarget } from "@/lib/onboarding/bedtime";
import type { NightEnds } from "@/lib/tonight";

type NightEndsFormProps = {
  value: NightEnds;
};

/**
 * Perfil «Hora de dormir»: the clock Hoy uses to say «acaba 23:19» or «se pasa 14 min».
 * Each row opens the Bienvenida's moon + hour drum in a sheet; changes save as you scroll.
 */
export const NightEndsForm = ({ value }: NightEndsFormProps) => {
  const [nightEnds, setNightEnds] = useState(value);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [target, setTarget] = useState<BedtimeTarget>("weekday");
  const generation = useOpenGeneration(sheetOpen);
  const { status, persist } = useNightEndsSave();

  const titleId = useId();

  const open = (next: BedtimeTarget) => {
    setTarget(next);
    setSheetOpen(true);
  };

  return (
    <ProfileSection id="hora-de-dormir" title="Hora de dormir">
      <ProfileGroup>
        <ProfileRow
          icon={<MoonIcon />}
          label="Entre semana"
          value={<span className="font-serif text-xl text-paper tabular-nums">{nightEnds.weekday}</span>}
          onClick={() => open("weekday")}
          ariaLabel={`Entre semana: terminas de ver a las ${nightEnds.weekday}. Cambiar`}
        />
        <ProfileRow
          icon={<WeekendMoonIcon />}
          iconClassName="bg-accent/15 text-accent"
          label="Viernes y sábado"
          value={<span className="font-serif text-xl text-paper tabular-nums">{nightEnds.weekend}</span>}
          onClick={() => open("weekend")}
          ariaLabel={`Viernes y sábado: terminas de ver a las ${nightEnds.weekend}. Cambiar`}
        />
      </ProfileGroup>
      <p className="text-sm leading-relaxed text-fog">
        Con esto Hoy te dice si termina a tiempo: «acaba a las 23:19» o «se pasa 14 min». Se guarda al instante.
      </p>
      <p className="text-xs text-mist">Las madrugadas (antes de las 06:00) cuentan como la noche anterior.</p>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} labelledBy={titleId} align="bottom">
        <div className="flex flex-col px-5 pt-3">
          <SheetHandle className="self-center" />
          <h2 id={titleId} className="pb-4 font-serif text-2xl text-paper">
            Hora de dormir
          </h2>
          {/* Remount per open so the dial starts on the row that was tapped; the drum scrolls, so no drag-dismiss on it. */}
          <div data-no-sheet-drag>
            <BedtimeDial
              key={generation}
              value={nightEnds}
              initialTarget={target}
              onChange={(next) => {
                setNightEnds(next);
                persist(next);
              }}
            />
          </div>
          <p className="min-h-5 pt-3 text-center text-xs text-mist" aria-live="polite">
            {nightEndsStatusCopy(status)}
          </p>
          <Button size="lg" className="mt-3 w-full press-scale" onClick={() => setSheetOpen(false)}>
            Listo
          </Button>
        </div>
      </Sheet>
    </ProfileSection>
  );
};
