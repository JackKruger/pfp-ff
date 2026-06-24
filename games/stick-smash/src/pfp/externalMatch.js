import { Bot } from '../../upstream/src/ai/Bot.js';
import { ROSTER } from '../../upstream/src/characters/roster.js';
import { STATE } from '../../upstream/src/entities/Stickman.js';

const PFP_INPUT_KIND = 'pfp';
const DEFAULT_LEVEL_ID = 'arena';
const MIN_FIGHTERS = 2;

export function installPfpExternalMatch(game, { controls, onGameOver }) {
  installInputProvider(game, controls);

  const checkGameOver = game._checkGameOver?.bind(game);
  game._checkGameOver = () => {
    if (!game.__pfpExternalMatch) return checkGameOver?.();
    return checkExternalGameOver(game, onGameOver);
  };

  const cleanup = game._cleanup?.bind(game);
  game._cleanup = (...args) => {
    document.body.classList.remove('pfp-mode');
    game.__pfpExternalMatch = null;
    return cleanup?.(...args);
  };

  game.startPfpMatch = (context) => startPfpMatch(game, context);
}

function installInputProvider(game, controls) {
  const input = game.input;
  if (!input || input.__pfpProviderInstalled) return;

  const getSnapshotFor = input.getSnapshotFor.bind(input);
  input.getSnapshotFor = (source) => {
    if (source?.kind === PFP_INPUT_KIND) {
      return controls.getSnapshotForSlot(source.slot);
    }
    return getSnapshotFor(source);
  };
  input.__pfpProviderInstalled = true;
}

function startPfpMatch(game, context) {
  const shellPlayers = [...(context.players ?? [])].sort((a, b) => a.slot - b.slot);
  const firstPlayer = shellPlayers[0];

  game.net?.disconnect();
  game._lastLocalMP = false;
  game._lastExtras = null;

  game._startMatch({
    character: 'bolt',
    name: firstPlayer?.displayName || 'P1',
    bots: 0,
    levelId: context.settings?.levelId || DEFAULT_LEVEL_ID,
    isOnline: false,
    localMP: false,
  });

  for (const player of game.players) player?.destroy?.();
  game.players = [];
  game.localPlayers = [];
  game.localPlayer = null;

  game.__pfpExternalMatch = {
    context,
    startedAt: Date.now(),
    gameOverReported: false,
  };

  const usedCharacters = new Set();
  for (let index = 0; index < shellPlayers.length; index++) {
    const player = shellPlayers[index];
    const pick = chooseCharacter(player.slot, index, usedCharacters);
    const stickman = game._spawnPlayer({
      name: player.displayName || `P${player.slot + 1}`,
      character: pick,
      isLocal: true,
      inputSource: { kind: PFP_INPUT_KIND, slot: player.slot },
    });
    stickman.pfpSlot = player.slot;
    stickman.pfpProfileId = player.profileId;
    game.localPlayers.push(stickman);
  }

  game.localPlayer = game.localPlayers[0] ?? null;
  game.character = game.localPlayer?.character ?? null;

  const botsToAdd = Math.max(0, MIN_FIGHTERS - shellPlayers.length);
  for (let index = 0; index < botsToAdd; index++) {
    const pick = chooseCharacter(index + shellPlayers.length + 1, index, usedCharacters);
    const bot = game._spawnPlayer({
      name: pick.name,
      character: pick,
      isBot: true,
    });
    bot.botBrain = new Bot(bot);
  }

  game.gameCam.setTargets(game.players);
  game.gameCam.setLocal(game.localPlayer);
  if (game.localPlayer) {
    game.gameCam.center.set(game.localPlayer.position.x, game.localPlayer.position.y + 1.2, 0);
    game.gameCam.target.copy(game.gameCam.center);
    game.gameCam.zoom = 14;
    game.gameCam.zoomTarget = 14;
  }

  game._startCountdown?.();
  game.menu.hide();
  document.body.classList.add('pfp-mode');
  game.running = true;
}

function chooseCharacter(slot, fallbackIndex, usedCharacters) {
  let pick = ROSTER[slot % ROSTER.length] || ROSTER[fallbackIndex % ROSTER.length];
  if (usedCharacters.has(pick.id)) {
    pick = ROSTER.find((candidate) => !usedCharacters.has(candidate.id)) || pick;
  }
  usedCharacters.add(pick.id);
  return pick;
}

function checkExternalGameOver(game, onGameOver) {
  const match = game.__pfpExternalMatch;
  if (!match || match.gameOverReported || !game.localPlayers?.length) return;

  const stillIn = game.players.filter((player) => player && player.lives > 0);
  const totalEverIn = game.players.filter(Boolean).length;
  if (totalEverIn <= 1) return;

  if (game.localPlayers.length === 1) {
    const local = game.localPlayer;
    if (local && local.lives <= 0 && local.state === STATE.DEAD) {
      return finishExternalGame(game, onGameOver, { winner: null, reason: 'ko' });
    }
  }

  if (stillIn.length === 0) {
    return finishExternalGame(game, onGameOver, { winner: null, reason: 'draw' });
  }

  if (stillIn.length === 1) {
    return finishExternalGame(game, onGameOver, { winner: stillIn[0], reason: 'victory' });
  }
}

function finishExternalGame(game, onGameOver, { winner, reason }) {
  const match = game.__pfpExternalMatch;
  if (!match || match.gameOverReported) return;

  game.running = false;
  match.gameOverReported = true;
  onGameOver?.({
    context: match.context,
    startedAt: match.startedAt,
    endedAt: Date.now(),
    winner,
    players: game.players,
    reason,
  });
}
