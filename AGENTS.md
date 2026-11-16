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
- Scope public landing tokens to `.landing` to preserve account themes.
- Subdirectories have their own `AGENTS.md`; read it before changing files there.
- MDB polyfills: client-environment-only Vite hooks resolving to ESM shims (no shared/resolve aliases, no global injection); init MDB globals and invoke the reader only in browser file-selection handlers so server imports stay native.
- National standards use local PDF/OCR extraction and editable confirmation before owner-scoped writes; shared standard-rules applies season and Dec-31 age intervals across sporting views. Legacy undated standards remain all-year.
- Root-boundary module download failures retry via a user-triggered full page reload; router invalidation alone retains rejected lazy imports. Ordinary errors keep the existing reset flow.
- Dashboard metrics use pure `src/lib/dashboard-summary.ts` with the shared nine-month selector; count bests per athlete/event/course and qualifying marks by Dec-31 category to avoid mixed-pool or repeated-swim totals.
- Client meet file preparation is shared in `src/lib/meet-files.ts`; navigation presentation lives in `src/components/app-navigation.tsx` without changing the authenticated gate.
- Manual entries live in owner-scoped `meet_entries`, separate from final results, with parent guards and cascading deletion; pure entry seeding/minimum/ranking rules live in `src/lib/entry-rules.ts` and entries-only SD3 never includes final times or splits.
- Coach reports: client-only dynamic ExcelJS; WhatsApp sharing needs preview + confirmation (private data).
- AQUA ranking uses pure entry-rules selection of each athlete's best stored score in the nine-month window; UI and exports share coach-reports rows to prevent duplicate-swim inflation.
- PDFs fetch active owner-scoped standard_versions snapshots at generation; atomic invoker import/activation RPCs preserve history; matching uses meet-year Dec-31 age, sex, event and course.
- Training-zone arithmetic lives in pure `src/lib/training-zones.ts`; use eligible individual event/course references and explicitly coach-entered speed ranges, never claim race-only Olbrecht thresholds; calibration is temporary and isolated by reference in the profile tool because no persistence was requested.
- Hy-Tek file parsing/export lives in `src/lib/hytek/` (HY3 + SDIF) and DB writing in `src/lib/importer.ts`; keep parsers pure so they stay testable without the database.
- Access Jet 4 imports use a dynamically loaded browser MDB reader in `src/lib/access.ts` and conservative pure schema normalization; preview raw tables, explicit numeric time units and skipped data before writing so unknown schemas are never silently assumed compatible.
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
- Profile rankings and tracking PDFs share the window selector in `src/lib/athlete-records.ts`; sort eligible times ascending, charts chronological.
- Tracking PDF charts use the pure event/course series selector and vector drawing in `src/lib/athlete-progress-pdf.ts`; paginate labelled swims without truncation so print remains readable and export needs no canvas.
- Reset deletes only the caller's RLS-visible rows, then cleans only captured private club prefixes through Storage API; never empty the shared bucket. Preserve accounts and roles.
- PDF imports use browser-local PDF.js/Tesseract without paid calls; pure result and standards parsers feed review before writes. Link crawling follows portal/index pages; labelled HTML tables use official-time columns and each event page retains its round.
- Athlete history transfers copy results/splits (never move or edit originals) via admin-checked copy_athlete_history, logged in record_transfers and undoable; fuzzy identity scoring is pure in src/lib/history-match.ts.
- Age categories: per-account swim_categories (Venezuela fallback) passed to categoryBounds; saving re-links standards by name.
- Demo: immutable local fixtures only; no DB calls, for privacy.
- Achievements are derived transactionally from full result history in owner-scoped deferred database triggers; preserve stable result/type/scope identities on reimport, use best daily swim when exact chronology is unavailable, and keep qualification tied to the active official snapshot and December-31 season/category.
- Report branding is per club, with private rasterized proportional logos; document-scoped table palettes and PDF framing preserve calculations, while browser-local PDF.js provides mobile previews. Public shares are explicit sanitized club-scoped snapshots in private storage, resolved only by hashed random capabilities with expiry/revocation checks on every read; never expose signed storage URLs or private records. Demo report generation uses local fictional fixtures only.
