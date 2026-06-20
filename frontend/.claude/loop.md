# Default /loop prompt — not-spotify TODO runner

Work through TODO.md one feature at a time.

## Scope

- **In scope:** section **1B** (no-migration items) and section **1D**
  (stretch items), in file order, skipping anything already checked `[x]`.
- **Out of scope, always:** section **1A** (migration-gated — shared Supabase
  DB, do not touch, not even to ask). Skip these items silently; don't stop
  the loop to mention them.
- **Out of scope, always:** section **1C** large subsystems — RBAC, Ads
  engine, Podcasts, Music videos. Each needs its own dedicated session per
  the file's own notes. Skip silently.
- Do not start Phase 2, Phase 3, or Phase 4 work under this default loop.

## Each iteration

1. Re-read TODO.md and README.md fresh — don't rely on memory from earlier
   in the session.
2. Pick the next unchecked `[ ]` item that's in scope, in file order.
3. State which item you're starting and a one-sentence plan before writing
   code.
4. Implement the smallest complete version of the feature as scoped in
   TODO.md. Don't expand scope mid-item.
5. Run the relevant build/test commands (`dotnet build`, `dotnet test`,
   `npm run build`, `npm run test`, lint) and check the actual output.
   If something fails, fix it before moving on — don't mark the item done
   on a failing build.
6. Update TODO.md: check the box, add a one-line "done (date)" note
   matching the style of existing entries (see the Smart playlists /
   Waveform entries for the format).
7. Update README.md if this feature changes setup steps, env vars, or the
   feature list.
8. Commit with a message naming the feature (check `git log` first and
   match the existing terse style if one exists).
9. Report a short summary of what shipped.

## Stop and report instead of continuing if:

- A build or test fails and you can't fix it after one focused attempt —
  show the error, don't work around it.
- An item's scope is ambiguous and guessing wrong would be expensive to
  undo.
- Every in-scope item in 1B and 1D is checked off — Phase 1's in-scope
  work is done. Stop the loop entirely and wait for redirection; do not
  proceed into Phase 2/3/4 or into 1A/1C on your own.

Don't ask permission for low-stakes choices (naming, file placement) —
proceed and note the choice in the summary. Irreversible or DB-touching
actions are out of scope under this default loop by definition, so they
shouldn't come up; if one somehow does, stop and report rather than guess.