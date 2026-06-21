import { describe, expect, it } from "vitest";
import { chooseRaceBotActions } from "../src/systems/bot.js";

describe("raskulls race bot", () => {
  it("runs right by default", () => {
    expect(
      chooseRaceBotActions({
        blockedAhead: false,
        onGround: true,
        frenzyEnergy: 0,
        hasPowerup: false,
      }),
    ).toMatchObject({
      moveX: 1,
      justDig: false,
      justJump: false,
      justPower: false,
    });
  });

  it("digs and jumps when blocked on the ground", () => {
    expect(
      chooseRaceBotActions({
        blockedAhead: true,
        onGround: true,
        frenzyEnergy: 0,
        hasPowerup: false,
      }),
    ).toMatchObject({
      justDig: true,
      justJump: true,
    });
  });

  it("uses Frenzy or held powerups", () => {
    expect(
      chooseRaceBotActions({
        blockedAhead: false,
        onGround: true,
        frenzyEnergy: 80,
        hasPowerup: false,
      }).justPower,
    ).toBe(true);

    expect(
      chooseRaceBotActions({
        blockedAhead: false,
        onGround: true,
        frenzyEnergy: 0,
        hasPowerup: true,
      }).justPower,
    ).toBe(true);
  });
});
