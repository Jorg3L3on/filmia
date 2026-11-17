import type { CSSProperties, ReactNode } from "react";
import { ANTOJO_IDS, type AntojoId } from "@/lib/para-ti/antojos";
import { NEUTRAL_ROOM, ROOMS, type Room } from "@/lib/para-ti/rooms";

const roomStyle = (room: Room) =>
  ({ "--room-rgb": room.rgb, "--room-rgb-2": room.rgb2 }) as CSSProperties;

/**
 * Para ti's room (FIL-I60-4): every antojo's light is painted behind the page and only the active
 * one is lit, so changing antojo cross-fades the room. Gradients and opacity only; the looping
 * light (flicker, glint…) runs only on the active room and never with reduced motion (CSS).
 */
export const ParaTiRoom = ({ antojo, children }: { antojo: AntojoId | null; children: ReactNode }) => (
  <div
    className="para-ti"
    data-antojo={antojo ?? "inicio"}
    data-entrance={antojo ? ROOMS[antojo].entrance : "still"}
    style={roomStyle(antojo ? ROOMS[antojo] : NEUTRAL_ROOM)}
  >
    <div className="para-ti-backdrop" aria-hidden="true">
      <div className="para-ti-light" data-room="inicio" data-active={antojo == null || undefined} style={roomStyle(NEUTRAL_ROOM)} />
      {ANTOJO_IDS.map((id) => (
        <div
          key={id}
          className="para-ti-light"
          data-room={id}
          data-light={ROOMS[id].light}
          data-active={antojo === id || undefined}
          style={roomStyle(ROOMS[id])}
        />
      ))}
    </div>
    {children}
  </div>
);
