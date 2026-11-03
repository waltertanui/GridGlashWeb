# GridClash web

Browser adaptation of https://github.com/waltertanui/Dots-And-Boxes. The original repository is cloned in ../original. dist/gameLogic.js is the original TypeScript game engine with types removed using Node's stripTypeScriptTypes.

Requires Node 24. Run `npm start`, then open http://127.0.0.1:4173. Run `npm test` for game engine checks. The dist folder can also be served by any static host.

Includes computer play (three difficulties), same-device two-player play, a diamond board, names, undo, and scores. Switching play mode starts a new match immediately; difficulty updates immediately. A new game resets the current match. The original online WebSocket mode is not connected in this static edition. Fonts use Google Fonts with local fallbacks.

Computer turns are owned by dist/match.js and run automatically after every human move. Turns always alternate, including after one or two boxes are captured. Choose Computer starts under First move to see an automatic opening. Peach lines, a marker on the latest move, and the computer activity record make its moves visible. Tests cover automatic scheduling, every difficulty and starter, cancellation on restart/undo, capture chains and full matches.

## Anonymous analytics and Vercel

See [VERCEL.md](VERCEL.md) for deployment and the three required server environment variables. Open `/admin` for private counts of visitors, visits, starts and completions. Local data stays in ignored `.data/`; production requires Upstash Redis. Player names are excluded. `/privacy` provides a browser opt-out. The full project, including `api` and `lib`, is required on Vercel; a static-only `dist` upload cannot collect statistics.

## Enclosure capture rule

Completed individual boxes score normally (including two completed unit boxes sharing one last line). Otherwise, if a line separates two closed multi-box areas, only the side with more unclaimed boxes is awarded: 3 vs 4 gives 4; 2 vs 3 gives 3. Count only unclaimed cells, not total geometric area. Previously claimed cells retain their owners. Equal point totals choose the side above a horizontal closing line or left of a vertical line. Both sides are never combined for a multi-box capture. The pre-drawn border counts. Turns still alternate. This highest-score policy replaces the previous smaller-pocket rule. The computer uses the same scoring function.
