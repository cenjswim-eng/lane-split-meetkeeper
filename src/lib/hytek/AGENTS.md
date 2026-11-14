# Hy-Tek rules
- Meet Manager entry export uses the dedicated SDIF v3 writer in `src/lib/hytek/meet-manager-entries.ts` (A0/01, C1/C2, D0, Z0), validates identities and emits fixed-width ASCII; leave legacy result export independent.
- Decode legacy Hy-Tek text as Windows-1252 when UTF-8 is invalid; keep fixed-width columns stable, reject unsupported athlete layouts visibly, and never overwrite existing final times with entry-only imports.
- EV3/HYV setup uses browser-safe swimparse with strict validation and preview; import_meet_setup saves meet-specific course cuts atomically without creating results or replacing national standards.
- HY3 warnings retain line numbers and raw records; reset athlete/event context at record boundaries and retain the existing owner-scoped athletes/results/splits schema rather than parallel tables, preventing misattributed times without weakening privacy.
