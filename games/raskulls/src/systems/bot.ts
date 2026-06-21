import type { PlayerActions } from "./input.js";

export interface BotDecisionInput {
  blockedAhead: boolean;
  onGround: boolean;
  frenzyEnergy: number;
  hasPowerup: boolean;
}

export function chooseRaceBotActions(input: BotDecisionInput): PlayerActions {
  const shouldDig = input.blockedAhead;
  const shouldJump = input.blockedAhead && input.onGround;
  const shouldPower = input.frenzyEnergy >= 65 || input.hasPowerup;

  return {
    moveX: 1,
    moveY: shouldDig ? 0 : 0,
    jump: shouldJump,
    dig: shouldDig,
    power: shouldPower,
    start: false,
    back: false,
    justJump: shouldJump,
    justDig: shouldDig,
    justPower: shouldPower,
    justStart: false,
    justBack: false,
  };
}
