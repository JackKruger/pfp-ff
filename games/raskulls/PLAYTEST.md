# Raskulls Manual Playtest Scenarios

Run these scenarios after each significant change to confirm core mechanics feel correct.

---

## Scenario 1: Four-Player Race with Block Shortcuts

**Setup**
- Launch a 4-player race (or 1 human + 3 bots) on **Dig Rush**.
- All players start at default positions near the left wall.

**What to observe**
- Dig walls at columns 14, 30, 50, and 63 create forced chokepoints.
- Players who destroy a wall's colored block group clear the path for everyone behind them.
- Bots attempt to dig when blocked; a human can exploit bot-cleared paths.
- Boostie at column 18 is reachable early — collecting it and activating Frenzy provides a speed boost through the next wall section.
- Gem pickups at columns 10, 27, 47, and 66 are tiebreakers only; racing for them should not be worth sacrificing position.

**Success criteria**
- At least one player reaches the finish tile within 120 seconds.
- Block groups clear together (not one tile at a time).
- No player is permanently stuck behind an indestructible block.
- Final rankings are ordered by finish time, not gem count.

---

## Scenario 2: Frenzy Route Where Boostie Placement Decides the Fastest Line

**Setup**
- Launch a 2-player or 1-player-vs-bots race on **Cliff Climb**.
- One player takes the direct path (no Boosties); the other detours to collect both Boostie pickups (columns 9 and 28).

**What to observe**
- The Boostie at column 9 is near an early platform. A player who grabs it and activates Frenzy runs ~34% faster through the blue-block section.
- The Boostie at column 28 requires a slight detour left before the green section.
- A player who skips both Boosties but digs efficiently may still win if they choose the right wall to break.
- If a player activates Frenzy before reaching the dig wall, they cover distance faster but may lack energy for a second burst later.

**Success criteria**
- Collecting both Boosties and timing Frenzy activation gives a measurable lead through at least one section.
- A pure-dig player (no Frenzy) can still finish — Frenzy is an advantage, not a requirement.
- Frenzy energy drains visibly during the speed boost; the player's body scales up slightly while active.
- Frenzy cannot be reactivated immediately after draining — energy must be refilled above 30.

---

## Scenario 3: Gray-Block Chain Shortcut

**Setup**
- Launch a 2-player or 1-player-vs-bots race on **Gray Gambit**.
- Let one player approach the 2×2 gray cluster at column 29 and break an adjacent block.

**What to observe**
- The 2×2 gray group (columns 29–30, rows 15–16) has 4 connected gray blocks. After any adjacent block is removed and gravity resolves, the gray cluster should remain connected and auto-explode if it reaches 4.
- Alternatively: a player's wand strike adjacent to the gray cluster does NOT directly destroy gray blocks — the cluster must self-explode via the chain rule.
- When the cluster explodes, the single gray block above (column 29, row 11) should fall, land adjacent to the other gray cluster at column 50, potentially triggering a second explosion.
- The resulting cleared passage lets players shortcut over the colored platform below.

**Success criteria**
- A 4-connected gray group explodes automatically after gravity resolves; no wand strike required.
- A group of 3 gray blocks does NOT explode.
- Chain explosions fire in sequence (gray cluster 1 explodes → gray falls → cluster 2 forms → cluster 2 explodes).
- The triggering player is NOT killed or eliminated in race mode — they may be briefly displaced by block drop animations.
- The cleared passage is usable by any player.

---

## Scenario 4: Powerup Disruption Without Unfair Instant Death

**Setup**
- Launch a 2-player race on any level. Have one player collect a **StunBolt** (available on Dig Rush at column 41) and fire it at the other player.
- Then have a player with Frenzy active run into a player who has activated their **Shield**.

**What to observe**
- **StunBolt**: The targeted player is stunned for ~700 ms and pushed slightly in the bolt direction. They can still control their character after the stun ends. They do NOT die or lose lives in race mode.
- **Frenzy shove (unshielded)**: A Frenzy-active player running into an unshielded player shoves them with `frenzyHitKnockbackX` (240px/s) and `frenzyHitKnockbackY` (170px/s upward). Victim is stunned for ~360 ms.
- **Shield reflects frenzy shove**: A Frenzy-active player who runs into a shielded player is pushed *back* with 55% of the normal frenzy knockback. The shielded player's shield glows briefly (scale pulse). The attacker is NOT stunned — just deflected.
- **Regular body overlap**: Two players without Frenzy who overlap receive a small bounce-apart (55 px/s), no stun.
- **Hazard (spike) in race mode**: Touching spikes stuns briefly, bounces the player upward, drains some frenzy energy, and removes their held powerup. Player does NOT die.

**Success criteria**
- No powerup interaction kills a player outright in race mode.
- Shield acts as a meaningful defensive option: it converts a Frenzy hit into a reflected shove.
- StunBolt creates a temporary setback (under 1 second) without ending the target's race.
- Players can recover from all disruption and continue racing.
- The overall race remains competitive; disruption is a delay, not elimination.
