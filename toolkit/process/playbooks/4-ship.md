# 4. Ship — piece `ship-edge`

**In:** composed build, `pack.json` · **Out:** release, hosted endpoint · **Emit:** `stage.ship.done`, `release.published`

1. Open a PR; the `process-cycle` workflow must go green.
2. Merge to `main` and tag a release (`gh release create vX.Y.Z --generate-notes`).
3. Host the runtime if the edge is a service; link the endpoint in the pack.
4. Announce the pack in the marketplace index → Earn.
