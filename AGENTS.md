<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Swimming system rules
- Training-zone arithmetic lives in pure `src/lib/training-zones.ts`; use eligible individual event/course references and explicitly coach-entered speed ranges, never claim race-only Olbrecht thresholds; calibration is temporary and isolated by reference in the profile tool because no persistence was requested.
- Hy-Tek file parsing/export lives in `src/lib/hytek/` (HY3 + SDIF) and DB writing in `src/lib/importer.ts`; keep parsers pure so they stay testable without the database.
- Decode legacy Hy-Tek text as Windows-1252 when UTF-8 is invalid; keep fixed-width columns stable, reject unsupported athlete layouts visibly, and never overwrite existing final times with entry-only imports.
- Access Jet 4 imports use a dynamically loaded browser MDB reader in `src/lib/access.ts` and conservative pure schema normalization; preview raw tables, explicit numeric time units and skipped data before writing so unknown schemas are never silently assumed compatible.
- Keep MDB crypto polyfill hooks and configuration scoped to Vite's client environment; invoke the reader only from file-selection handlers so server runtime imports retain native implementations.
- Resolve client polyfill aliases through client-only hooks to ESM shims, never environment.resolve.alias or shared aliases; disable global plugin injection and initialize MDB globals only in the browser file-reading handler to avoid optimizer cycles and server replacement.
- Club document extraction lives in `src/lib/club-document.ts`: read PDF text locally with a dynamic PDF.js worker, auto-save explicitly structured roster rows and recognized Access member tables, and retain originals with a visible notice when extraction is incomplete.
- Club membership is separate from competition athletes; explicit Access column mappings populate an admin-only club register, private originals are retained, and atomic reimports match stable source keys without deleting absent members or overwriting manual status and notes.
- All times are stored as integer milliseconds (`*_ms`); format only at display time via `src/lib/swim.ts`.
- Athlete de-duplication order on import: `tm_athlete_id` → `federation_id` → name + birth date.
- Import meet/event identities through admin-checked, SECURITY INVOKER atomic RPCs with advisory locks; reuse normalized meet name/date/course and compatible event identities so result/split upserts retain their existing unique identities on reimport.
- Approved accounts access only owner_id-scoped records via RLS and immutable parent-ownership guards; the app_owner alone approves accounts, without cross-account sporting access. Import identities are owner-scoped; notifications resolve the owner address server-side.
- Relay lineup optimization lives in `src/lib/relay.ts` (pure functions, no DB); PDF reports in `src/lib/reports.ts` (jspdf + jspdf-autotable, generated client-side).
- Age categories use the Dec-31 rule via `ageAtDec31`/`ageGroup` in `src/lib/swim.ts`; never compute categories from current age.
- Exports return prepared Files; the shared export dialog delivers them through native file sharing or delayed-revocation downloads, with ZIP wrapping for SD3 compatibility, so mobile user activation survives generation.
- Athlete deletion requires explicit permanent-deletion confirmation and relies on database cascades for results/splits; club membership remains independently managed.
- Club documents accept private Access originals and PDF attachments; roster and individual tracking reports use prepared-file sharing with all eligible records and splits, without a display-count truncation.
- Athlete profile rankings and tracking PDFs share the pure calendar-window selector in `src/lib/athlete-records.ts`; preserve stored history and sort eligible times ascending, while progression charts remain chronological.
- Tracking PDF charts use the pure event/course series selector and vector drawing in `src/lib/athlete-progress-pdf.ts`; paginate labelled swims without truncation so print remains readable and export needs no canvas.
- Reset deletes only the caller's RLS-visible rows, then cleans only captured private club prefixes through Storage API; never empty the shared bucket. Preserve accounts and roles.
- PDF imports: Meet Manager result text is parsed by pure `src/lib/pdf-results.ts`; AI extraction (results/roster) runs only in the admin-checked server function `src/lib/pdf-ai.functions.ts` and its output is re-validated by pure normalizers before preview/import, so AI never writes directly.
