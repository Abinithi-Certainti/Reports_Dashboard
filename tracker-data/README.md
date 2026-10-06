# OnRoute Takeover Tracker data

Daily copy of the data behind the OnRoute Takeover Tracker page.

| File | What it holds |
|---|---|
| `groups.json` | The 13 component groups: kind, summary, repos, contents, health, takeover stage, owner id, next step, Jira Epic |
| `knowledge.json` | Each person's knowledge ratings (0-4), groups they help on, and strong areas, keyed by an opaque person id |
| `snapshots.json` | One row per day: groups we can support, groups owned, team knowledge average, strong areas, areas with no backup |

**Left out on purpose while this repo is public:** each group's `risks` list and the free-text `notes`. They contain security findings and must only be stored in a private repo.

Person ids (`u_...`) are opaque and contain no names.
