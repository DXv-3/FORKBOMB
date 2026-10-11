# toolkit/process — FORKBOMB running on itself

The `run-cycle` piece and its stage playbooks. Everything here is a brick in the `forkbomb-core` pack.

```bash
node toolkit/process/cycle.js            # validate pieces, catalog, packs, connectors
node toolkit/process/cycle.js checklist  # print one full cycle as a checklist
node toolkit/process/cycle.js next tag   # what to run after a stage
```

Playbooks: [discover](playbooks/1-discover.md) · [tag](playbooks/2-tag.md) · [snap](playbooks/3-snap.md) · [ship](playbooks/4-ship.md) · [earn](playbooks/5-earn.md) · [improve](playbooks/6-improve.md)
