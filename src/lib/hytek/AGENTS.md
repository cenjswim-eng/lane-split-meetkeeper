# Hy-Tek rules
- Meet Manager entry export uses the dedicated SDIF v3 writer in `src/lib/hytek/meet-manager-entries.ts` (A0/01, C1/C2, D0, Z0), validates identities and emits fixed-width ASCII; leave legacy result export independent.
- Decode legacy Hy-Tek text as Windows-1252 when UTF-8 is invalid; keep fixed-width columns stable, reject unsupported athlete layouts visibly, and never overwrite existing final times with entry-only imports.
