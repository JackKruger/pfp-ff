// Boot. Rapier WASM init must happen before Game is constructed.
import { initRapier } from './physics/cannon-shim.js';
import { createPfpRuntime } from './pfp/PfpRuntime.js';
import { buildStickSmashResult } from './pfp/results.js';
import './util/__weaponDebug.js';

async function boot() {
  const pfpRuntime = createPfpRuntime();
  try {
    await initRapier();
  } catch (err) {
    document.getElementById('loading').textContent = 'Physics engine failed to load: ' + (err?.message || err);
    return;
  }
  const { Game } = await import('./Game.js');
  const game = new Game({ pfpRuntime });
  window.game = game;
  game.onPfpGameOver = ({ winner, players, reason }) => {
    if (!game._pfp) return;
    const endedAt = Date.now();
    pfpRuntime.client.gameOver(buildStickSmashResult({
      context: game._pfp.context,
      startedAt: game._pfp.startedAt,
      endedAt,
      players,
      winner,
      reason,
    }));
  };

  pfpRuntime.client.onLaunch((context) => game.startPfpMatch(context));
  pfpRuntime.client.onPause(() => {
    game.paused = true;
  });
  pfpRuntime.client.onResume(() => {
    game.paused = false;
    game.menu.hide();
  });
  pfpRuntime.client.onTerminate(() => {
    game.endMatch();
    pfpRuntime.controls.dispose();
    pfpRuntime.client.dispose();
  });

  document.getElementById('game').addEventListener('contextmenu', (e) => e.preventDefault());

  function checkOrientation() {
    if (window.innerHeight > window.innerWidth && matchMedia('(pointer: coarse)').matches) {
      document.body.classList.add('portrait');
    } else {
      document.body.classList.remove('portrait');
    }
  }
  addEventListener('resize', checkOrientation);
  addEventListener('orientationchange', checkOrientation);
  checkOrientation();
  pfpRuntime.client.ready();
}

boot();
