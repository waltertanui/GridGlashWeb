# GridClash web

Browser adaptation of https://github.com/waltertanui/Dots-And-Boxes. The original repository is cloned in ../original. dist/gameLogic.js is the original TypeScript game engine with types removed using Node's stripTypeScriptTypes.

Requires Node 24. Run `npm start`, then open http://127.0.0.1:4173. Run `npm test` for game engine checks. The dist folder can also be served by any static host.

Includes computer play (three difficulties), same-device two-player play, a diamond board, names, undo, and scores. Switching play mode starts a new match immediately; difficulty updates immediately. A new game resets the current match. The original online WebSocket mode is not connected in this static edition. Fonts use Google Fonts with local fallbacks.

Computer turns are owned by dist/match.js and run automatically after every human move. Turns always alternate, including after one or two boxes are captured. Choose Computer starts under First move to see an automatic opening. Peach lines, a marker on the latest move, and the computer activity record make its moves visible. Tests cover automatic scheduling, every difficulty and starter, cancellation on restart/undo, capture chains and full matches.

## Anonymous analytics and Vercel

See [VERCEL.md](VERCEL.md) for deployment and the three required server environment variables. Open `/admin` for private counts of visitors, visits, starts and completions. Local data stays in ignored `.data/`; production requires Upstash Redis. Player names are excluded. `/privacy` provides a browser opt-out. The full project, including `api` and `lib`, is required on Vercel; a static-only `dist` upload cannot collect statistics.

## Enclosure capture rule

Completed individual boxes score normally (including two completed unit boxes sharing one last line). Otherwise, if a line separates two closed multi-box areas, only the side with more unclaimed boxes is awarded: 3 vs 4 gives 4; 2 vs 3 gives 3. Count only unclaimed cells, not total geometric area. Previously claimed cells retain their owners. Equal point totals choose the side above a horizontal closing line or left of a vertical line. Both sides are never combined for a multi-box capture. The pre-drawn border counts. Turns still alternate. This highest-score policy replaces the previous smaller-pocket rule. The computer uses the same scoring function.

### Valid pockets versus the remaining field

Capture eligibility is checked before comparing scores. A closed played-line loop can capture its interior, including partial internal dividers. For border-assisted pockets, a region still spanning multiple untouched tips or containing unfinished internal divider branches is the remaining playing field, not a capture candidate. A region surrounding a different unclaimed pocket is also excluded. Only eligible pockets compete by number of new points. Regression tests cover a two-box closure beside an eighteen-box open field, both higher-side examples, and single-corner safety.


## Online multiplayer

Choose **Online · play a friend**, enter your player name, and create a room. Send the invite link to your friend; they enter a name and press Join room. The room uses a random starter and the same capture and alternating-turn rules as local play. Both players must request a rematch to reset the board. Online play has no undo.

The existing `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are also used for rooms on Vercel; no extra service is required. Room credentials are private to each browser tab and survive refreshes in session storage. Invite links only include the room code. A room allows two seats, and expires 24 hours after the last join, move or rematch. Closing the tab may lose that player's seat credential. The browser polls every three seconds; temporary network errors retry automatically.

The server validates all moves, turns and ownership. Atomic Redis version comparisons prevent simultaneous updates from overwriting each other. Without Redis, the local development server uses memory (rooms disappear on server restart); production requires Redis. Anonymous analytics classify each player's online game as a two-player game.
