# Default /loop prompt — not-spotify Phase 1 finisher

Complete **all of Phase 1** in TODO.md, one feature at a time, in whatever
order makes sense, until every realistically-shippable item is checked off.

## Scope

- **In scope:** every unchecked `[ ]` item in **Phase 1** — sections **1B**,
  **1C** (large subsystems, migrations OK), and **1D** (stretch). Pick whatever
  order is most efficient (finish in-progress work first; do contained items
  before sprawling ones). Migrations against the shared Supabase DB are allowed
  — keep them **idempotent** (`CREATE … IF NOT EXISTS`) and always
  `dotnet build` before any `dotnet run`.
- **Skip silently** (leave unchecked, don't stop the loop over them): items
  blocked by something unavailable in this environment — paid/third-party API
  keys (Concert/tour info), missing toolchains (Tauri needs Rust), or work
  explicitly deferred to **Phase 2 storage** (Streaming quality, Adaptive
  streaming, Personal uploads locker, Music videos' heavy storage). Note them
  in the summary so the user knows why they're still open.
- **1A** is already complete; leave it. Do not start Phase 2, 3, or 4.

## Each iteration

1. Re-read TODO.md and README.md fresh — don't rely on memory from earlier
   in the session.
2. Pick the next unchecked `[ ]` Phase 1 item (any order; prefer in-progress
   or contained work first).
3. State which item you're starting and a one-sentence plan before writing
   code.
4. Implement the smallest complete version of the feature as scoped in
   TODO.md. Don't expand scope mid-item.
5. Run the relevant build/test commands (`dotnet build`, `dotnet test`,
   `npm run build` / `npx vite build`, `npm run test`, lint) and check the
   actual output. If something fails, fix it before moving on — don't mark
   the item done on a failing build. (`npm run build`'s `tsc -b` step is
   pre-broken on a missing `vitest/config` type — verify with
   `npx tsc -p tsconfig.app.json --noEmit` + `npx vite build` instead.)
6. Update TODO.md: check the box, add a one-line "done (date)" note
   matching the style of existing entries (see the Smart playlists /
   Waveform entries for the format).
7. Update README.md if this feature changes setup steps, env vars, or the
   feature list.
8. Commit with a message naming the feature (check `git log` first and
   match the existing terse style). Commit only the files for that feature;
   never commit build artifacts (`bin/`, `obj/`, `node_modules/.tmp`).
9. Report a short summary of what shipped.

## Stop and report instead of continuing if:

- A build or test fails and you can't fix it after one focused attempt —
  show the error, don't work around it.
- Every realistically-shippable Phase 1 item is checked off (only the
  environment-blocked items above remain) — Phase 1 is done. Stop the loop
  and wait for redirection; do not proceed into Phase 2/3/4 on your own.

Don't ask permission for anything at all. Anything is acceptable to achieve the main tasks. As long as it is not damaging to the user's computer.
