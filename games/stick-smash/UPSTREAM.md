# Stick Smash Upstream

- Source: https://github.com/KreatureofKreation/stick-smash
- Submodule path: `games/stick-smash/upstream`
- Current submodule commit: `4c09534` (`pfp/external-host-hooks`)
- Upstream `master` base: `bbf861119093fe5a03f806c4c2bdbc7340771bc7`
- Permission status: the PFP-FF maintainer confirmed in this workspace that the
  upstream owner is collaborating on this shell and allows vendoring Stick Smash
  here.

## Integration Shape

The upstream game source is kept in the `upstream` git submodule and should stay
standalone. PFP-specific code lives outside that submodule:

- `src/main.js` boots upstream `Game` and wires PFP lifecycle events.
- `src/pfp/externalMatch.ts` adapts shell launches, forwarded input, and match
  completion without editing upstream files.
- `src/input/PfpControls.ts` maps PFP control frames to Stick Smash snapshots.
- `src/pfp/results.ts` maps Stick Smash players to PFP standings.

The adapter uses generic host hooks from the `pfp/external-host-hooks` upstream
branch. Once those hooks are merged upstream, move the submodule pointer to the
merged upstream commit.

## Updating

Use the submodule pointer as the source of truth:

```sh
git submodule update --remote games/stick-smash/upstream
pnpm --filter @pfp/stick-smash typecheck
pnpm exec vitest run games/stick-smash/test
pnpm --filter @pfp/stick-smash build
```

Do not make PFP-specific edits inside `games/stick-smash/upstream`. Changes that
belong to the original game should be developed as upstream PRs.

The upstream repository did not include a `LICENSE` file at the inspected
commit. Keep this note updated if a formal license is added upstream.
