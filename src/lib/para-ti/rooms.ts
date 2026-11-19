import type { AntojoId } from "@/lib/para-ti/antojos";

/**
 * Each antojo's room (FIL-I60-4): the colour wash and light behind the page, and the motion
 * personality its entrance and its shelf use (F5). Colours sit on the app's dark canvas, so
 * paper text keeps its contrast on every room.
 */
export type RoomLight = "flicker" | "warm" | "cool" | "strobe" | "still" | "crisp" | "quick" | "glint";

export type Room = {
  /** Main wash, an `r g b` triple for `rgb(var(--room-rgb) / a)`. */
  rgb: string;
  /** Second, lower light. */
  rgb2: string;
  light: RoomLight;
  /** Shelf spring (F5): stiffness and damping of the settle, and how far spines lean with speed. */
  motion: { stiffness: number; damping: number; lean: number };
  /** Entrance of the antojo's view. */
  entrance: "bounce" | "slow" | "fast" | "flicker" | "still" | "crisp" | "quick" | "glint";
};

export const NEUTRAL_ROOM: Room = {
  rgb: "255 122 69",
  rgb2: "201 178 255",
  light: "still",
  motion: { stiffness: 170, damping: 26, lean: 1 },
  entrance: "still",
};

export const ROOMS: Record<AntojoId, Room> = {
  reir: { rgb: "255 154 61", rgb2: "255 214 102", light: "warm", motion: { stiffness: 260, damping: 16, lean: 1.2 }, entrance: "bounce" },
  llorar: { rgb: "86 132 255", rgb2: "120 170 220", light: "cool", motion: { stiffness: 90, damping: 22, lean: 0.6 }, entrance: "slow" },
  miedo: { rgb: "150 18 34", rgb2: "40 44 52", light: "flicker", motion: { stiffness: 140, damping: 30, lean: 0.8 }, entrance: "flicker" },
  adrenalina: { rgb: "255 72 48", rgb2: "255 170 40", light: "strobe", motion: { stiffness: 340, damping: 24, lean: 1.6 }, entrance: "fast" },
  pensar: { rgb: "122 108 255", rgb2: "70 90 140", light: "still", motion: { stiffness: 120, damping: 30, lean: 0.4 }, entrance: "still" },
  reciente: { rgb: "79 209 255", rgb2: "200 240 255", light: "crisp", motion: { stiffness: 220, damping: 26, lean: 1 }, entrance: "crisp" },
  corta: { rgb: "170 240 90", rgb2: "120 220 200", light: "quick", motion: { stiffness: 300, damping: 28, lean: 1.1 }, entrance: "quick" },
  joya: { rgb: "240 193 74", rgb2: "120 90 40", light: "glint", motion: { stiffness: 150, damping: 26, lean: 0.8 }, entrance: "glint" },
};

export const roomOf = (antojo: AntojoId | null) => (antojo ? ROOMS[antojo] : NEUTRAL_ROOM);
