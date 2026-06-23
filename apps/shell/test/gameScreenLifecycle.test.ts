import { describe, expect, it } from "vitest";
import {
  transitionGameScreenLifecycle,
  type GameScreenLifecycleAction,
  type GameScreenLifecycleState,
} from "../src/screens/gameScreenLifecycle.js";

describe("game screen lifecycle transitions", () => {
  it("requests a host pause effect when pausing active gameplay", () => {
    expect(transitionGameScreenLifecycle(state(), "requestPause")).toEqual({
      phase: "overlay",
      overlayItem: "resume",
      effect: "pause",
    });
  });

  it("requests a host resume effect when resuming from the overlay", () => {
    expect(transitionGameScreenLifecycle(state({ phase: "overlay" }), "requestResume")).toEqual({
      phase: "playing",
      effect: "resume",
    });
  });

  it("confirm-resume resumes from the overlay", () => {
    expect(
      transitionGameScreenLifecycle(
        state({ phase: "overlay", overlayItem: "resume" }),
        "confirmOverlay",
      ),
    ).toEqual({
      phase: "playing",
      effect: "resume",
    });
  });

  it("confirm-quit navigates home from the overlay", () => {
    expect(
      transitionGameScreenLifecycle(
        state({ phase: "overlay", overlayItem: "quit" }),
        "confirmOverlay",
      ),
    ).toEqual({ effect: "navigateHome" });
  });

  it("does not pause or resume in dead-end, loading, or error states", () => {
    const cases: Array<{
      name: string;
      state: GameScreenLifecycleState;
      action: GameScreenLifecycleAction;
    }> = [
      {
        name: "no selected game cannot pause",
        state: state({ hasSelectedGame: false }),
        action: "requestPause",
      },
      {
        name: "no selected game cannot resume",
        state: state({ hasSelectedGame: false, phase: "overlay" }),
        action: "requestResume",
      },
      { name: "loading cannot pause", state: state({ phase: "loading" }), action: "requestPause" },
      {
        name: "loading cannot resume",
        state: state({ phase: "loading" }),
        action: "requestResume",
      },
      { name: "error cannot pause", state: state({ phase: "error" }), action: "requestPause" },
      { name: "error cannot resume", state: state({ phase: "error" }), action: "requestResume" },
    ];

    for (const testCase of cases) {
      expect(transitionGameScreenLifecycle(testCase.state, testCase.action), testCase.name).toEqual(
        { effect: "none" },
      );
    }
  });
});

function state(overrides: Partial<GameScreenLifecycleState> = {}): GameScreenLifecycleState {
  return {
    hasSelectedGame: true,
    phase: "playing",
    overlayItem: "resume",
    ...overrides,
  };
}
