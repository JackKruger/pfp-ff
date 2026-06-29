// Boot. Rapier WASM init must happen before Game is constructed.
import { initRapier } from '../upstream/src/physics/cannon-shim.js';
import { createPfpRuntime } from './pfp/PfpRuntime.js';
import { PfpControls } from './input/PfpControls.js';
import { installPfpExternalMatch } from './pfp/externalMatch.js';
import { buildStickSmashResult } from './pfp/results.js';
import '../upstream/src/util/__weaponDebug.js';

async function boot() {
  const pfpRuntime = createPfpRuntime();
  try {
    await initRapier();
  } catch (err) {
    document.getElementById('loading').textContent = 'Physics engine failed to load: ' + (err?.message || err);
    return;
  }
  const { Game } = await import('../upstream/src/Game.js');
  const game = new Game();
  window.game = game;
  installPfpExternalMatch(game, {
    controls: new PfpControls(pfpRuntime.controls),
    onGameOver: ({ context, startedAt, endedAt, players, winner, reason }) => {
      pfpRuntime.client.gameOver(buildStickSmashResult({
        context,
        startedAt,
        endedAt,
        players,
        winner,
        reason,
      }));
    },
  });

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
