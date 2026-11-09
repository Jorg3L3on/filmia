import { ignoreBenignViewTransitionRejections } from "@/lib/view-transition-noise";

// Runs before hydration, so this listener is first in line (FIL-I44-3).
ignoreBenignViewTransitionRejections(window);
