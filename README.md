# Vacation Games

A LAN-only party game host for phones. One gamemaster (admin) picks a mini-game and runs it live for a room of players — everyone else just needs a phone and a QR code, no app install. A TV (over HDMI) shows a join lobby before the party starts, then the live leaderboard for the rest of the night.

Built as the successor to an old single-player Flask treasure hunt. This version turns it into something a whole room can play together.

## How it works

Three screens, three jobs:

- **`/admin`** — the gamemaster's control room. Start the party, pick a game, start/end it, watch the leaderboard, override a score if something goes wrong. This URL is never shared or QR'd — keeping it private is the only access control there is.
- **`/play`** — each player's own phone. Enter a name once, then either watch the leaderboard (between games) or play whatever game is currently active.
- **`/tv`** — plugged into the TV over HDMI. Shows a join QR code and player list before the party starts, then the live leaderboard for the rest of the party. Some games briefly take over the screen for a shared moment (a drawing, a guess board, a reveal) before handing it back.

## Tech stack

- Node.js + Express + Socket.io
- Plain HTML/CSS/JS on the frontend — no framework, no build step
- In-memory server state only, no database — this is meant to run as one process for the length of a party

## Getting started

```bash
npm install
npm start
```

The server prints two URLs and a QR code on startup:

- `http://<your-lan-ip>:3000/play` — put this QR code on the TV (or share the link) so people can join from their phones
- `http://<your-lan-ip>:3000/admin` — open this on your own phone/laptop and keep it to yourself

Everyone needs to be on the same Wi-Fi/LAN. No accounts, no internet access required once it's running.

## Games

| Game | What it is | Status |
| --- | --- | --- |
| Quick Question (`demoGame`) | One multiple-choice question, first correct answer wins. | Test/template game only — proves the admin → play → tv pipeline works, not really meant to be played at a party. |
| Higher or Lower | Guess whether the next story came out earlier or later than the one shown, build a streak. | Working |
| Spyfall | Everyone shares a secret location except one Spy — question each other, then vote. | Working |
| Fake It Til You Make It | Everyone gets a secret word except the Imposter, who gets a decoy — give one-word clues, then vote out who's faking it. | Working, see note below |
| Heads Up! | One player guesses words from everyone else's clues before the clock runs out. | Working |
| Wavelength | The Clue Giver sees a secret target on a spectrum and gives one clue; everyone else guesses where it lands. | Working, see note below |
| Telephone Doodles (`drawful`) | Everyone starts a prompt chain, draws and re-writes it as it passes along, then the group replays each chain. | **Bugged — needs testing and diagnostics before it's party-ready.** |
| Psych! | A real trivia question appears, everyone secretly writes a fake answer to fool the group, then votes for the one they think is true. | **Bugged — needs testing and diagnostics before it's party-ready.** |

## Known issues & roadmap

- **`demoGame` is a test fixture, not a real game.** It exists to prove the admin/play/tv wiring works end to end and to act as the template for every other game — leave it out of an actual party's game list.
- **Telephone Doodles (`drawful`) and Psych! are both bugged.** Something in each is broken in practice — needs a proper playtest with multiple phones to reproduce the issue(s) and figure out what's actually going wrong before trusting either at a party.
- **Wavelength: the target number lands on 1 or 10 too often for how interesting those rounds are.** Right now the target is picked uniformly from 1–10, but the endpoints are the least interesting rounds to play (least room for a clue to be "close but not exact"). Worth lowering how often 1 and 10 come up relative to the middle of the scale.
- **Fake It Til You Make It: character pairs need two improvements.**
  - Add each character's universe/franchise to the data, so a player who doesn't recognize a character still has something to go on.
  - Currently every pair is two characters from the *same* franchise. Try also matching similar characters *across different* franchises (not necessarily the same universe) — that makes the Imposter's decoy harder to spot rather than easier.

## Project docs

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — the full technical design: folder structure, shared state shape, Socket.io events, and the contract every game module follows.
- [`GAME_PLANS.md`](./GAME_PLANS.md) — per-game specs and build notes from when each game was designed.
- [`CLAUDE.md`](./CLAUDE.md) — project conventions used while building this with Claude Code.

## A note on image assets

`static/mountain_images/` (can be used by Higher or Lower and Fake It Til You Make It) are gitignored and not part of this repo. A fresh clone will run, but this game will be missing their images until that folder is populated separately. Added `static/fandom_images/` as an example, because it's only 1.7MB.
