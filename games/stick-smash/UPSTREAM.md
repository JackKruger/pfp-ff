# Stick Smash Upstream

- Source: https://github.com/KreatureofKreation/stick-smash
- Submodule path: `games/stick-smash/upstream`
- Upstream commit: `bbf861119093fe5a03f806c4c2bdbc7340771bc7`
- Permission status: the PFP-FF maintainer confirmed in this workspace that the
  upstream owner is collaborating on this shell and allows vendoring Stick Smash
  here.

## Integration Shape

The upstream game source is kept in the `upstream` git submodule and should stay
standalone. PFP-specific code lives outside that submodule:

- `src/main.js` boots upstream `Game` and wires PFP lifecycle events.
- `src/pfp/externalMatch.js` adapts shell launches, forwarded input, and match
  completion without editing upstream files.
- `src/input/PfpControls.js` maps PFP control frames to Stick Smash snapshots.
- `src/pfp/results.js` maps Stick Smash players to PFP standings.

When upstream accepts generic host hooks, replace the adapter monkey patches in
`src/pfp/externalMatch.js` with those public hooks and update the submodule
pointer.

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
