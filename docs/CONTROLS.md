# Shell-Forwarded Controls

`@pfp/controls` is the optional input layer for games that want the shell to
normalize local controller input and send it through the SDK. It exists beside
direct Gamepad API input, not as a replacement for every game.

Use it when:

- The game is a simple canvas/arcade/party game.
- You want consistent controller mapping and button-edge behavior.
- You want future AI-generated games to avoid writing input boilerplate.

Prefer direct input when:

- The game is a custom engine with its own input system.
- The game needs raw browser device state.
- You are integrating Phaser, Three.js, Godot, or another engine that already
  has input assumptions.

---

## Manifest Modes

Each game declares its input mode in `game.manifest.ts`:

```ts
input: {
  mode: "direct",
}
```

Available modes:

- `direct`: shell passes `gamepadIndex`; the game polls `navigator.getGamepads()`.
- `forwarded`: shell sends normalized `ControlFrame` messages; the game does not
  need to poll devices.
- `hybrid`: shell sends frames, and the game may also poll devices directly.

The shell only starts a control forwarder for `forwarded` and `hybrid` games.
Pong currently uses `hybrid` input as the reference migration path; other current
games remain `direct`.

---

## Action Mapping

Forwarded-control games can define named actions:

```ts
input: {
  mode: "forwarded",
  actions: {
    move: [{ source: "leftStickX", deadzone: 0.2 }],
    jump: [{ source: "a" }],
    fire: [{ source: "rt" }],
  },
}
```

Supported sources currently include:

- Sticks: `leftStickX`, `leftStickY`, `rightStickX`, `rightStickY`
- D-pad axes: `dpadX`, `dpadY`
- Buttons/triggers: `a`, `b`, `x`, `y`, `lb`, `rb`, `lt`, `rt`, `start`, `back`

Bindings can include:

- `deadzone`: ignore smaller absolute values.
- `scale`: multiply the source value, clamped to `-1..1`.

---

## Game-Side Usage

```ts
import { createGameClient } from "@pfp/sdk";
import { createControlClient } from "@pfp/controls";

const client = createGameClient();
const controls = createControlClient(client);

controls.onFrame((frame) => {
  const p1 = frame.players.find((player) => player.slot === 0);
  if (!p1) return;

  const moveX = p1.actions.move?.value ?? 0;
  const jumpPressed = p1.actions.jump?.justPressed ?? false;
  const firing = p1.actions.fire?.pressed ?? false;
});

client.ready();
```

Convenience helpers:

```ts
controls.axis(0, "move");
controls.isPressed(0, "fire");
controls.justPressed(0, "jump");
controls.getLatestFrame();
```

---

## Frame Shape

The SDK carries a `ControlFrame` from shell to game:

```ts
interface ControlFrame {
  seq: number;
  now: number;
  dtMs: number;
  paused: boolean;
  players: ControlPlayerFrame[];
}
```

Each player frame includes:

- `slot` and `profileId`
- `connected`
- `source`: `gamepad`, `keyboard`, `ai`, or `none`
- normalized axes: `moveX`, `moveY`, `aimX`, `aimY`, optional `throttle`
- raw button states
- named action states from the manifest

Button/action states expose:

```ts
{
  pressed: boolean;
  justPressed: boolean;
  justReleased: boolean;
  value: number;
}
```

---

## Shell Lifecycle

The shell control forwarder follows the game host lifecycle:

- Starts after `ready -> launch` for `forwarded` or `hybrid` games.
- Sends frames on the shell ticker only while the game phase is `playing`.
- Pauses/resumes with the shell pause overlay.
- Disposes on game over, request exit, error, incompatible SDK, or unmount.

This keeps direct-input games unchanged while making forwarded controls available
for future games.
