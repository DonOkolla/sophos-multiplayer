# SOPHOS — Knowledge Brings People Together

A multiplayer trivia game MVP with a midnight-navy and antique-gold visual identity. Built as a monorepo with a React/Vite browser client and a Node/Socket.IO authoritative game server.

## What is included
- Create and join private rooms with 5-character room codes
- Live lobby with player presence and host controls
- Three rounds / 15 curated sample questions
- 20-second question timer, server-side answer validation and scoring
- Speed bonus, answer explanations, scoreboard and final results
- Oracle's Insight power-up in round 2; Golden Focus and Chronos in round 3
- Surprise Double Knowledge questions
- Reconnect support for the same browser session
- Responsive layout and accessible focus states

## Run locally
Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```
Open http://localhost:5173 in two or more browser tabs. Create a room in one tab and join with the code from another. For LAN testing, configure Vite's host as needed and make the server reachable.

The web client uses `VITE_SERVER_URL` to locate the multiplayer server. For local development it defaults to `http://localhost:3001`.

## Build
```bash
npm run build
npm start
```

## Important status
This is an initial playable MVP, not yet a verified production deployment. Before submitting, test complete matches with multiple devices, audit the question bank, run the build and browser tests, and deploy the web client and persistent Socket.IO server to public hosting. The public submission URL does not exist until deployment is completed.

## Latest polish
The results screen now includes a reduced-motion-aware champion reveal, match-review stats (correct answers, accuracy, points), and a **Challenge your rivals** rematch action. The rematch returns the existing room to the lobby and resets match-specific score and power-up state. Please run `npm install` and `npm run build` and test a full match/rematch with two browser sessions before deploying; the current environment could not complete dependency installation for verification.
