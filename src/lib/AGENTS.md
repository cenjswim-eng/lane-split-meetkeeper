# Roster architecture
- Roster form validation and identity/category derivation live in pure roster-rules.ts; compute age/category rather than persisting stale values.
- Preserve legacy club name and athlete active_status compatibility through database synchronization triggers; new forms use full_name and is_active without breaking importers.
- Club codes are unique per owner; identity collision guards lock owner/ID atomically so private accounts remain independent.
- Tournament arithmetic lives in pure tournament-rules.ts; use December-31 eligibility and eligible nine-month event/course results, while retaining cutoff age as an explicit separate utility.
- Reuse existing events, entries, results and splits; relay entries have owner and parent guards, with deferred club consistency for atomic merges.
- Live meet operation uses existing results/splits and relay entries, an invoker atomic heat RPC and round-aware scoring; browser timing is manual backup, never certified hardware timing. Leaderboards remain owner-scoped.
- Entry assistant calculations are pure; owner-private drafts commit through an invoker RPC to existing entries, preserving tournament guards. Pool conversion requires an explicit coach-entered factor and remains estimated.
- Workspace navigation preserves published routes; shared presentation filters are keyed by authenticated account and never authorize data access or modify export/calculation rules.