# Gym app project guidance

- Treat this repository as a separate gym app project. Do not bring in context, preferences, or tasks from unrelated German work.
- Before working, read `docs/PROJECT_MEMORY.md` and the relevant parts of `README.md`. Existing `docs/HANDOVER.md` and `docs/REVIEW.md` contain historical context; verify their status against the current code before treating their tasks as outstanding.
- Keep durable project context in `docs/PROJECT_MEMORY.md`: confirmed requirements, decisions, completed work, validation results, and outstanding tasks. Update it after substantive work. Summarize useful context rather than storing entire conversations.
- Do not put passwords, access tokens, private keys, or private personal information in project notes. This repository is public.
- The app has no build step. Use the scripts in `package.json` and the development instructions in `README.md` for appropriate validation.
- After changing files loaded by the app, run `npm run sw-hash`. Keep version files consistent as documented in `README.md`.
- If this checkout is inside a ChatGPT project mirror, files under the mirror's `sources/` directory are read-only. Work in this repository checkout instead.
