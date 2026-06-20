# Default /loop prompt — not-spotify Phase 1 finisher

Complete **all of Phase 1** in TODO.md, one feature at a time, in whatever
order makes sense, until every realistically-shippable item is checked off.

## Scope

- **Finish EVERY unchecked `[ ]` item in Phase 1 — no exceptions, no skips.**
  Sections **1B**, **1C** (large subsystems), and **1D** (stretch). This now
  explicitly **includes the items that were previously deferred**: Streaming
  quality, Adaptive streaming / quality selection, Music videos, Personal
  uploads locker, Family / Duo / Student plans, Audio recognition, Concert/tour
  info, and the Desktop wrapper (Tauri). Get them all done.
- **Nothing is "environment-blocked" anymore.** Ship a **working, honest,
  demo-scale** version of each, with or without a migration:
  - No real object storage? Use the existing storage service / Supabase / seed
    data / public sample assets — demo scale is fine.
  - No paid/third-party API key (Concert/tour, AcoustID)? Build it against a
    free/no-key source, a local heuristic, or seeded/stub data — a real working
    feature, not a "Coming soon" placeholder.
  - Missing toolchain (Tauri needs Rust we can't build here)? Commit the full
    wrapper **scaffold + config + docs** so it's ready to `tauri build` on a
    machine that has Rust; that counts as done.
  - Stripe plans need price IDs from a dashboard? Wire the code + config keys +
    member-invite system so it works the moment the IDs are set; seed/test-mode
    fallbacks are fine.
  - Don't ship anything dishonest (no toggle/button that lies, no fake premium
    bypass) — but DO ship the smallest **real** version that works.
- Migrations against the shared Supabase DB are allowed — keep them
  **idempotent** (`CREATE … IF NOT EXISTS`, the Program.cs raw-SQL guard
  pattern) and always `dotnet build` before any `dotnet run`. Migrations are
  **optional**: prefer them when they make the feature real, skip them when a
  client-only / seed-only version is genuinely complete.
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
- **Every** unchecked Phase 1 item is now checked off — all of 1B/1C/1D are
  done. Phase 1 is complete. Stop the loop and wait for redirection; do not
  proceed into Phase 2/3/4 on your own.

Don't ask permission for anything at all. Anything is acceptable to achieve the main tasks. As long as it is not damaging to the user's computer.
