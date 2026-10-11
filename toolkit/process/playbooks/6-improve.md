# 6. Improve — piece `improve-upstream`

**In:** usage signals, issues, revenue path · **Out:** upstream PRs, wanted-board items · **Emit:** `stage.improve.done`, `upstream.fixed`

1. Turn top issues into fixes; send them upstream to the brick's origin repo.
2. Refresh `trust` flags (tests, maintained, security_reviewed) in each entry.
3. Bump `source.commit` to the improved upstream commit.
4. Post the gaps you hit as `wanted-brick` issues — they seed the next Discover.
5. Run `node toolkit/process/cycle.js next improve` and start again.
