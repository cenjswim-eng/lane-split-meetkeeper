# Roster architecture
- Roster form validation and identity/category derivation live in pure roster-rules.ts; compute age/category rather than persisting stale values.
- Preserve legacy club name and athlete active_status compatibility through database synchronization triggers; new forms use full_name and is_active without breaking importers.
- Club codes are unique per owner; identity collision guards lock owner/ID atomically so private accounts remain independent.