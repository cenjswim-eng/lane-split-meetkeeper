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
- Hy-Tek file parsing/export lives in `src/lib/hytek/` (HY3 + SDIF) and DB writing in `src/lib/importer.ts`; keep parsers pure so they stay testable without the database.
- All times are stored as integer milliseconds (`*_ms`); format only at display time via `src/lib/swim.ts`.
- Athlete de-duplication order on import: `tm_athlete_id` → `federation_id` → name + birth date.
- Data access is admin-only via `has_role(auth.uid(),'admin')` RLS; the first signed-up user becomes admin by trigger.
- Relay lineup optimization lives in `src/lib/relay.ts` (pure functions, no DB); PDF reports in `src/lib/reports.ts` (jspdf + jspdf-autotable, generated client-side).
- Age categories use the Dec-31 rule via `ageAtDec31`/`ageGroup` in `src/lib/swim.ts`; never compute categories from current age.
