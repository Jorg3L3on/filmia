"use client";

import { useSyncExternalStore } from "react";
import { readLastDockTab } from "@/lib/dock-search";
import { navTabMatcher } from "@/lib/nav";

const subscribeNoop = () => () => {};
const noTab = () => null;

/** Matcher for the active tab, ficha included (its origin tab; server render = Hoy). FIL-I44-8. */
export const useNavTabMatch = () => navTabMatcher(useSyncExternalStore(subscribeNoop, readLastDockTab, noTab));
