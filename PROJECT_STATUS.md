# SOPHOS build status — 27 October 2026

## Implemented in this starter MVP
- Premium responsive home and lobby UI
- Room creation and joining over Socket.IO
- Server-owned question timer, answer validation and scoring
- 15-question / 3-round flow with answer explanations
- Scoreboard and final results screen
- Power-up interface and server event handlers (needs full balancing and integration tests)
- Custom SVG cover image

## Must be fixed/tested before public submission
- Install dependencies and run production builds (installation in this environment timed out, so build is not verified here).
- Complete proper reconnect flow using stored session credentials.
- Implement Chronos as a genuine per-player grace period, including answer acceptance and speed-bonus semantics.
- Add duel mechanics and fully specified duel scoring; current MVP does not yet include playable duels.
- Add host departure handling tests, room cleanup, rate limiting and anti-abuse protections.
- Add automated tests for scoring, timers, power-ups, reconnection, edge cases and full match.
- Verify/correct question wording, answer facts and sources; expand beyond the 15-question demo bank.
- Test on at least two browsers/devices and deploy frontend plus persistent server.
- Create final PNG/JPG cover export if the submission form does not accept SVG.

This is a starter MVP codebase and not a public deployed game yet. No public URL has been created.

## Champion's Ceremony polish (2026-10-27)
- Added a restrained animated crown arrival, gold sweep across the winner card, and staggered results reveal; respects `prefers-reduced-motion`.
- Added match-review statistics for the current player: correct answers, accuracy, and points. Leaderboard rows now show correct answers and accuracy based on the 15-question match.
- Added a prominent “Challenge your rivals” action and server-side `room:rematch` event. A rematch returns the same room to lobby and resets scores, correctness counts, power-up usage, answers, question index, reveal, and winner state.
- Verification limitation: dependency installation timed out in this environment, so a complete TypeScript production build and live multiplayer regression test could not be run here. Run `npm install` and `npm run build` locally before deployment. Validate the rematch with two browser sessions.
