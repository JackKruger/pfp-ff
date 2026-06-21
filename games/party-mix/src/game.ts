import type { LaunchContext, PlayerStanding } from "@pfp/sdk";
import { createBoard, step, TILE_COINS, type Board } from "./board.js";
import { pickMinigame } from "./minigames/registry.js";
import { PAYOUT, type Minigame } from "./minigames/types.js";

/** Held input state for one player; the game derives edges itself. */
export interface PlayerInput {
  a: boolean;
  b: boolean;
  dx: number;
  dy: number;
}

export interface InputFrame {
  inputs: PlayerInput[];
  anyStart: boolean;
}

export type SoundKind = "roll" | "step" | "coin" | "bad" | "advance" | "win" | "star";

export interface Player {
  slot: number;
  profileId: string | null;
  name: string;
  color: string;
  tile: number;
  coins: number;
  stars: number;
  minigamesWon: number;
}

/**
 * Phases of one match:
 *   intro    — title card, any A starts
 *   turn     — "P{n}'s turn", press A to roll
 *   rolling  — die spins, press A to lock the value
 *   moving   — pawn animates one tile at a time
 *   resolve  — landed tile effect shown briefly
 *   mgIntro  — minigame name + rules card, any A (or timeout) starts it
 *   minigame — the active minigame runs
 *   mgResult — minigame payouts shown briefly
 *   roundEnd — "Round X complete" beat, any A continues
 *   results  — final ranking; match is over
 */
export type Phase =
  | "intro"
  | "turn"
  | "rolling"
  | "moving"
  | "resolve"
  | "mgIntro"
  | "minigame"
  | "mgResult"
  | "roundEnd"
  | "results";

export const TOTAL_ROUNDS = 5;
const DIE_MIN = 1;
const DIE_MAX = 9;
const DIE_SPIN_MS = 70; // how fast the spinning number cycles while rolling
const STEP_MS = 180; // per-tile hop while moving
const RESOLVE_MS = 900; // how long the landed-tile result lingers
const MG_INTRO_MS = 3000; // auto-start the minigame after this if nobody presses A
const MG_RESULT_MS = 2600; // how long minigame payouts linger
export const STAR_COST = 20; // coins to buy a star when you land on the star tile

/** One row of a minigame payout summary, winner first. */
export interface PayoutRow {
  name: string;
  color: string;
  coins: number;
}

export interface GameState {
  board: Board;
  players: Player[];
  phase: Phase;
  round: number; // 1-based
  activeIdx: number; // index into players whose turn it is
  // transient per-phase fields
  die: number; // currently shown die value
  rolled: number; // locked roll value
  stepsLeft: number;
  timer: number; // ms accumulator for the current phase animation
  banner: string; // short status line for the landed-tile result
  events: SoundKind[];
  prevA: boolean[]; // last-frame A state per player, for edge detection
  minigame: Minigame | null; // active minigame instance, if any
  mgName: string; // name of the most recent minigame (for cards)
  mgRules: string; // rules line of the active minigame
  payout: PayoutRow[]; // last minigame's payout summary, winner first
  starTile: number; // board index where the buyable star currently sits
}

export function createGame(ctx: LaunchContext): GameState {
  const board = createBoard();
  const players: Player[] = ctx.players.map((p) => ({
    slot: p.slot,
    profileId: p.profileId,
    name: p.displayName,
    color: p.color,
    tile: 0,
    coins: 0,
    stars: 0,
    minigamesWon: 0,
  }));

  return {
    board,
    players,
    phase: "intro",
    round: 1,
    activeIdx: 0,
    die: 1,
    rolled: 0,
    stepsLeft: 0,
    timer: 0,
    banner: "",
    events: [],
    prevA: players.map(() => false),
    minigame: null,
    mgName: "",
    mgRules: "",
    payout: [],
    starTile: firstStarTile(board),
  };
}

/** Board index of the first star-kind tile (the star spots); falls back to 1. */
function firstStarTile(board: Board): number {
  const t = board.tiles.find((x) => x.kind === "star");
  return t ? t.index : 1;
}

/** True only on the frame `a` transitions false→true for that player. */
function pressedA(state: GameState, idx: number, frame: InputFrame): boolean {
  const now = frame.inputs[idx]?.a ?? false;
  const prev = state.prevA[idx] ?? false;
  return now && !prev;
}

function anyPressedA(state: GameState, frame: InputFrame): boolean {
  for (let i = 0; i < state.players.length; i++) {
    if (pressedA(state, i, frame)) return true;
  }
  return false;
}

/**
 * Advances the match by `dtMs`. Returns final standings once, when the match
 * reaches `results`; otherwise null. Mirrors the pong `advance` contract.
 */
export function advance(state: GameState, dtMs: number, frame: InputFrame): PlayerStanding[] | null {
  switch (state.phase) {
    case "intro":
      if (anyPressedA(state, frame) || frame.anyStart) {
        state.phase = "turn";
        state.events.push("advance");
      }
      break;

    case "turn":
      if (pressedA(state, state.activeIdx, frame)) {
        state.phase = "rolling";
        state.timer = 0;
        state.events.push("roll");
      }
      break;

    case "rolling": {
      state.timer += dtMs;
      if (state.timer >= DIE_SPIN_MS) {
        state.timer = 0;
        state.die = DIE_MIN + ((state.die - DIE_MIN + 1) % (DIE_MAX - DIE_MIN + 1));
      }
      if (pressedA(state, state.activeIdx, frame)) {
        state.rolled = state.die;
        state.stepsLeft = state.die;
        state.phase = "moving";
        state.timer = 0;
      }
      break;
    }

    case "moving": {
      state.timer += dtMs;
      if (state.timer >= STEP_MS) {
        state.timer = 0;
        const p = state.players[state.activeIdx]!;
        p.tile = step(state.board, p.tile, 1);
        state.stepsLeft--;
        state.events.push("step");
        if (state.stepsLeft <= 0) {
          resolveTile(state);
          state.phase = "resolve";
          state.timer = 0;
        }
      }
      break;
    }

    case "resolve":
      state.timer += dtMs;
      if (state.timer >= RESOLVE_MS) {
        endTurn(state);
      }
      break;

    case "mgIntro":
      state.timer += dtMs;
      if (anyPressedA(state, frame) || frame.anyStart || state.timer >= MG_INTRO_MS) {
        state.phase = "minigame";
        state.timer = 0;
      }
      break;

    case "minigame": {
      const mg = state.minigame;
      if (!mg) {
        finishMinigame(state);
        break;
      }
      mg.update(dtMs, frame.inputs);
      if (mg.done()) {
        applyPayout(state, mg);
        state.phase = "mgResult";
        state.timer = 0;
        state.events.push("coin");
      }
      break;
    }

    case "mgResult":
      state.timer += dtMs;
      if (anyPressedA(state, frame) || frame.anyStart || state.timer >= MG_RESULT_MS) {
        finishMinigame(state);
      }
      break;

    case "roundEnd":
      if (anyPressedA(state, frame) || frame.anyStart) {
        state.round++;
        state.activeIdx = 0;
        state.phase = "turn";
        state.events.push("advance");
      }
      break;

    case "results":
      // terminal; main reports gameOver once.
      break;
  }

  // Record this frame's A state for next-frame edge detection.
  for (let i = 0; i < state.players.length; i++) {
    state.prevA[i] = frame.inputs[i]?.a ?? false;
  }

  return state.phase === "results" ? buildStandings(state) : null;
}

function resolveTile(state: GameState): void {
  const p = state.players[state.activeIdx]!;

  // The buyable star: auto-purchase if affordable, then it hops to a new spot.
  if (p.tile === state.starTile) {
    if (p.coins >= STAR_COST) {
      p.coins -= STAR_COST;
      p.stars++;
      relocateStar(state);
      state.banner = `${p.name} bought a STAR! ☆`;
      state.events.push("star");
    } else {
      state.banner = `${p.name} can't afford a star (${STAR_COST})`;
    }
    return;
  }

  const tile = state.board.tiles[p.tile]!;
  if (tile.kind === "event") {
    runEvent(state, p);
    return;
  }

  const delta = TILE_COINS[tile.kind];
  if (delta > 0) {
    p.coins += delta;
    state.banner = `${p.name} +${delta} coins`;
    state.events.push("coin");
  } else if (delta < 0) {
    p.coins = Math.max(0, p.coins + delta);
    state.banner = `${p.name} ${delta} coins`;
    state.events.push("bad");
  } else {
    state.banner = `${p.name} lands on ${tile.kind}`;
  }
}

/** Moves the star to a different star-spot tile so it keeps roaming the board. */
function relocateStar(state: GameState): void {
  const spots = state.board.tiles.filter((t) => t.kind === "star" && t.index !== state.starTile);
  if (spots.length === 0) return;
  state.starTile = spots[Math.floor(Math.random() * spots.length)]!.index;
}

/** Event tiles: a small grab-bag of swings to keep the board lively. */
function runEvent(state: GameState, p: Player): void {
  const events: Array<() => void> = [
    () => {
      p.coins += 5;
      state.banner = `${p.name} found 5 coins! ◉`;
      state.events.push("coin");
    },
    () => {
      p.coins = Math.max(0, p.coins - 5);
      state.banner = `${p.name} dropped 5 coins`;
      state.events.push("bad");
    },
    () => {
      for (const other of state.players) other.coins += 2;
      state.banner = "Everyone gets 2 coins!";
      state.events.push("coin");
    },
    () => {
      // Swap coins with a random other player.
      const others = state.players.filter((o) => o !== p);
      if (others.length === 0) {
        p.coins += 3;
        state.banner = `${p.name} +3 coins`;
        state.events.push("coin");
        return;
      }
      const target = others[Math.floor(Math.random() * others.length)]!;
      const tmp = p.coins;
      p.coins = target.coins;
      target.coins = tmp;
      state.banner = `${p.name} swaps coins with ${target.name}!`;
      state.events.push("advance");
    },
  ];
  events[Math.floor(Math.random() * events.length)]!();
}

function endTurn(state: GameState): void {
  if (state.activeIdx < state.players.length - 1) {
    state.activeIdx++;
    state.phase = "turn";
  } else {
    // Everyone has moved this round → play a minigame.
    startMinigame(state);
  }
}

function startMinigame(state: GameState): void {
  const factory = pickMinigame();
  const views = state.players.map((p) => ({ slot: p.slot, name: p.name, color: p.color }));
  state.minigame = factory(views);
  state.mgName = state.minigame.name;
  state.mgRules = state.minigame.rules;
  state.payout = [];
  state.phase = "mgIntro";
  state.timer = 0;
  state.events.push("advance");
}

/** Converts minigame placements into coin rewards and a summary for rendering. */
function applyPayout(state: GameState, mg: Minigame): void {
  const order = mg.placements(); // player indices, winner first
  state.payout = order.map((idx, place) => {
    const p = state.players[idx]!;
    const coins = PAYOUT[place] ?? 0;
    p.coins += coins;
    if (place === 0) p.minigamesWon++;
    return { name: p.name, color: p.color, coins };
  });
}

function finishMinigame(state: GameState): void {
  state.minigame = null;
  if (state.round >= TOTAL_ROUNDS) {
    state.phase = "results";
    state.events.push("win");
  } else {
    state.phase = "roundEnd";
    state.events.push("advance");
  }
}

/** Ranks by stars, then coins. Ties share a rank. */
export function buildStandings(state: GameState): PlayerStanding[] {
  const ordered = [...state.players].sort(
    (a, b) => b.stars - a.stars || b.coins - a.coins,
  );

  const key = (p: Player) => `${p.stars}:${p.coins}`;
  const standings: PlayerStanding[] = [];
  let rank = 0;
  let prevKey = "";
  ordered.forEach((p, i) => {
    if (i === 0 || key(p) !== prevKey) rank = i + 1;
    prevKey = key(p);
    standings.push({
      slot: p.slot,
      profileId: p.profileId,
      rank,
      score: p.stars * 1000 + p.coins,
      stats: { stars: p.stars, coins: p.coins, minigamesWon: p.minigamesWon },
    });
  });
  return standings;
}
