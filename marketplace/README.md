# Marketplace

Pieces alone do not make a market. Circulation does.

## Growth engine

1. **Discovery** — catalog, search, packs, and featured bricks.
2. **Trust** — license clarity, tests, provenance, security signals.
3. **Composition** — connectors that make snaps cheap and repeatable.
4. **Revenue paths**
   - Hosted runtimes for popular pieces
   - Support and SLAs for teams
   - Premium packs (curated + maintained)
   - Sponsorships tied to piece usage
   - Marketplace listing fees once volume is real
5. **Feedback** — downloads, stars, issues, and revenue tell authors what to improve.

## Packs

A **pack** is a set of pieces + connectors aimed at one job (agent tooling, checkout, CI, creative pipelines). Packs are how markets form inside the larger ecosystem.

The market runs on a pack too: [`forkbomb-core`](../packs/forkbomb-core/pack.json) is FORKBOMB's own operating loop — discover, tag, snap, ship, earn, improve — shipped as pieces and connectors. Every revenue path above is the `earn-loop` piece; every feedback signal is `improve-upstream` refilling the wanted board. See [docs/PROCESS.md](../docs/PROCESS.md).

## Near-term moves

- [ ] Publish the public piece index from `pieces/entries/`
- [x] Define pack format (`packs/<name>/pack.json`) — see [packs/](../packs/README.md)
- [ ] Track provenance (source URL + commit) on every brick
- [ ] Open a "wanted bricks" board so demand pulls supply
