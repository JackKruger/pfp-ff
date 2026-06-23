export type GameScreenPhase = "loading" | "playing" | "overlay" | "error" | "done";
export type GameScreenOverlayItem = "resume" | "quit";

export type GameScreenLifecycleEffect = "none" | "pause" | "resume" | "navigateHome";

export type GameScreenLifecycleAction =
  | "requestPause"
  | "requestResume"
  | "confirmOverlay"
  | "requestQuitToHome"
  | "exitDeadEnd";

export type GameScreenLifecycleState = {
  hasSelectedGame: boolean;
  phase: GameScreenPhase;
  overlayItem: GameScreenOverlayItem;
};

export type GameScreenLifecycleTransition = {
  phase?: GameScreenPhase;
  overlayItem?: GameScreenOverlayItem;
  effect: GameScreenLifecycleEffect;
};

export function isGameScreenDeadEnd(state: GameScreenLifecycleState): boolean {
  return !state.hasSelectedGame || state.phase === "error";
}

export function transitionGameScreenLifecycle(
  state: GameScreenLifecycleState,
  action: GameScreenLifecycleAction,
): GameScreenLifecycleTransition {
  switch (action) {
    case "requestPause":
      if (state.hasSelectedGame && state.phase === "playing") {
        return { phase: "overlay", overlayItem: "resume", effect: "pause" };
      }
      return noLifecycleEffect();

    case "requestResume":
      if (state.hasSelectedGame && state.phase === "overlay") {
        return { phase: "playing", effect: "resume" };
      }
      return noLifecycleEffect();

    case "confirmOverlay":
      if (!state.hasSelectedGame || state.phase !== "overlay") return noLifecycleEffect();
      if (state.overlayItem === "quit") return { effect: "navigateHome" };
      return { phase: "playing", effect: "resume" };

    case "requestQuitToHome":
      return { effect: "navigateHome" };

    case "exitDeadEnd":
      if (isGameScreenDeadEnd(state)) return { effect: "navigateHome" };
      return noLifecycleEffect();
  }
}

function noLifecycleEffect(): GameScreenLifecycleTransition {
  return { effect: "none" };
}
