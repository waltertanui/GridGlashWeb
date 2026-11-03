export function createBoard(rows        , cols        )            {
  return {
    rows,
    cols,
    shape: 'square',
    hLines: Array.from({ length: rows + 1 }, () => Array(cols).fill(false)),
    vLines: Array.from({ length: rows }, () => Array(cols + 1).fill(false)),
    hLineOwner: Array.from({ length: rows + 1 }, () => Array(cols).fill(null)),
    vLineOwner: Array.from({ length: rows }, () => Array(cols + 1).fill(null)),
    boxes: Array.from({ length: rows }, () => Array(cols).fill(null)),
  };
}

export function createBoardWithBorder(rows        , cols        )            {
  const board = createBoard(rows, cols);
  for (let c = 0; c < cols; c++) {
    board.hLines[0][c] = true;
    board.hLines[rows][c] = true;
  }
  for (let r = 0; r < rows; r++) {
    board.vLines[r][0] = true;
    board.vLines[r][cols] = true;
  }
  return board;
}

export function createDiamondBoard()            {
  const radius = 3;
  const size = 2 * radius + 1;
  const center = radius;

  const mask              = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) =>
      Math.abs(r - center) + Math.abs(c - center) <= radius
    )
  );

  const board = createBoard(size, size);
  board.shape = 'diamond';
  board.shapeMask = mask;

  for (let r = 0; r <= size; r++) {
    for (let c = 0; c < size; c++) {
      const above = r > 0 && mask[r - 1][c];
      const below = r < size && mask[r][c];
      if (above !== below) board.hLines[r][c] = true;
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size; c++) {
      const left = c > 0 && mask[r][c - 1];
      const right = c < size && mask[r][c];
      if (left !== right) board.vLines[r][c] = true;
    }
  }

  return board;
}

function isCellActive(board           , r        , c        )          {
  if (!board.shapeMask) return r >= 0 && r < board.rows && c >= 0 && c < board.cols;
  if (r < 0 || r >= board.rows || c < 0 || c >= board.cols) return false;
  return board.shapeMask[r][c];
}

export function getHLineNeighborActivity(board           , r        , c        )                                     {
  return {
    above: isCellActive(board, r - 1, c),
    below: isCellActive(board, r, c),
  };
}

export function getVLineNeighborActivity(board           , r        , c        )                                    {
  return {
    left: isCellActive(board, r, c - 1),
    right: isCellActive(board, r, c),
  };
}

export function isBorderLine(board           , pos         )          {
  if (!board.shapeMask) {
    if (pos.type === 'h') return pos.row === 0 || pos.row === board.rows;
    return pos.col === 0 || pos.col === board.cols;
  }
  if (pos.type === 'h') {
    const { above, below } = getHLineNeighborActivity(board, pos.row, pos.col);
    return above !== below;
  }
  const { left, right } = getVLineNeighborActivity(board, pos.row, pos.col);
  return left !== right;
}

export function isLineAvailable(board           , pos         )          {
  if (isGameOver(board)) return false;
  if (pos.type === 'h') {
    const { above, below } = getHLineNeighborActivity(board, pos.row, pos.col);
    if (!above || !below) return false;
    return !board.hLines[pos.row][pos.col];
  }
  const { left, right } = getVLineNeighborActivity(board, pos.row, pos.col);
  if (!left || !right) return false;
  return !board.vLines[pos.row][pos.col];
}

export function drawLine(
  board           ,
  pos         ,
  playerIdx        ,
)                                                {
  if (!isLineAvailable(board, pos)) return { newBoard: board, claimedBoxes: 0 };

  const newBoard            = {
    ...board,
    hLines: board.hLines.map(r => [...r]),
    vLines: board.vLines.map(r => [...r]),
    hLineOwner: board.hLineOwner.map(r => [...r]),
    vLineOwner: board.vLineOwner.map(r => [...r]),
    boxes: board.boxes.map(r => [...r]),
  };

  if (pos.type === 'h') {
    newBoard.hLines[pos.row][pos.col] = true;
    newBoard.hLineOwner[pos.row][pos.col] = playerIdx;
  } else {
    newBoard.vLines[pos.row][pos.col] = true;
    newBoard.vLineOwner[pos.row][pos.col] = playerIdx;
  }

  let claimedBoxes = 0;
  for (const [br, bc] of getAdjacentBoxes(board, pos)) {
    if (newBoard.boxes[br][bc] === null && isBoxComplete(newBoard, br, bc)) {
      newBoard.boxes[br][bc] = playerIdx;
      claimedBoxes++;
    }
  }

  // A completed unit box is scored normally; it must not turn a corner
  // capture into a claim on the entire remaining field. When neither side
  // is a completed unit box, choose the closed region with the most new
  // points. Claimed cells never contribute to that comparison or transfer.
  const [first, second] = getAdjacentBoxes(board, pos);
  if (claimedBoxes === 0 && first && second) {
    const a = connectedRegion(newBoard, ...first);
    if (!a.some(([r, c]) => r === second[0] && c === second[1])) {
      const b = connectedRegion(newBoard, ...second);
      const unclaimed = region => region.filter(([r, c]) => board.boxes[r][c] === null);
      const explicitInterior = playedLoopInterior(newBoard);
      const aPoints = isCapturePocket(board, newBoard, a, explicitInterior) ? unclaimed(a) : [];
      const bPoints = isCapturePocket(board, newBoard, b, explicitInterior) ? unclaimed(b) : [];
      const captured = aPoints.length >= bPoints.length ? aPoints : bPoints;
      for (const [r, c] of captured) {
        newBoard.boxes[r][c] = playerIdx;
        claimedBoxes++;
      }
    }
  }
  return { newBoard, claimedBoxes };
}

// Flood through missing dividing lines. Existing ownership is not a wall;
// only real drawn lines and the edge of the board separate regions.
function connectedRegion(board, row, col) {
  const reached = new Set([row + ',' + col]), queue = [[row, col]];
  for (let i = 0; i < queue.length; i++) {
    const [r, c] = queue[i];
    const neighbors = [
      [r - 1, c, board.hLines[r][c]],
      [r + 1, c, board.hLines[r + 1][c]],
      [r, c - 1, board.vLines[r][c]],
      [r, c + 1, board.vLines[r][c + 1]],
    ];
    for (const [nr, nc, wall] of neighbors) {
      if (wall || !isCellActive(board, nr, nc)) continue;
      const key = nr + ',' + nc;
      if (!reached.has(key)) { reached.add(key); queue.push([nr, nc]); }
    }
  }
  return queue;
}

// A completed played loop is an explicit capture boundary, even when it
// contains partial internal dividers. Starting neutral borders are transparent
// for this check so they cannot make the whole board a capture at game start.
function playedLoopInterior(board) {
  const outside = new Set(['-1,-1']), queue = [[-1,-1]];
  for (let i=0;i<queue.length;i++) {
    const [r,c]=queue[i];
    for(const [nr,nc,owner] of [[r-1,c,board.hLineOwner[r]?.[c]],[r+1,c,board.hLineOwner[r+1]?.[c]],[r,c-1,board.vLineOwner[r]?.[c]],[r,c+1,board.vLineOwner[r]?.[c+1]]]) {
      const key=nr+','+nc;
      if(nr < -1 || nc < -1 || nr > board.rows || nc > board.cols || owner != null || outside.has(key))continue;
      outside.add(key);queue.push([nr,nc]);
    }
  }
  const interior=new Set();
  for(let r=0;r<board.rows;r++)for(let c=0;c<board.cols;c++)if(isCellActive(board,r,c)&&!outside.has(r+','+c))interior.add(r+','+c);
  return interior;
}

function isCapturePocket(before, after, region, explicitInterior) {
  const points=region.filter(([r,c])=>before.boxes[r][c]===null);
  if(!points.length || surroundsOtherCells(after,region))return false;
  if(points.every(([r,c])=>explicitInterior.has(r+','+c)))return true;
  const cells=new Set(region.map(([r,c])=>r+','+c));
  let openTips=0;
  for(const [r,c] of points) {
    // Multiple untouched tips identify the main playing field, not a pocket.
    const borderSides=Number(!isCellActive(after,r-1,c))+Number(!isCellActive(after,r+1,c))+Number(!isCellActive(after,r,c-1))+Number(!isCellActive(after,r,c+1));
    if(borderSides>=3 && ++openTips>1)return false;
  }
  // An unfinished divider inside a region is an open branch of the playing
  // field. Completing a pocket elsewhere must not sweep up that field.
  for(const [r,c] of region) {
    if(cells.has((r+1)+','+c)&&after.hLines[r+1][c])return false;
    if(cells.has(r+','+(c+1))&&after.vLines[r][c+1])return false;
  }
  return true;
}

// The outside remainder around an internal loop is not its captured interior.
// Reject ring-shaped regions that surround cells outside the candidate itself.
function surroundsOtherCells(board, region) {
  const blocked = new Set(region.map(([r,c]) => r + ',' + c));
  const visited = new Set(['-1,-1']), queue = [[-1,-1]];
  for (let i=0;i<queue.length;i++) {
    const [r,c]=queue[i];
    for (const [nr,nc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]) {
      const key=nr+','+nc;
      if(nr < -1 || nc < -1 || nr > board.rows || nc > board.cols || blocked.has(key) || visited.has(key)) continue;
      visited.add(key);queue.push([nr,nc]);
    }
  }
  for(let r=0;r<board.rows;r++)for(let c=0;c<board.cols;c++) {
    if(isCellActive(board,r,c)&&board.boxes[r][c]===null&&!blocked.has(r+','+c)&&!visited.has(r+','+c))return true;
  }
  return false;
}

export function getAdjacentBoxes(board           , pos         )                     {
  const result                     = [];
  if (pos.type === 'h') {
    if (isCellActive(board, pos.row - 1, pos.col)) result.push([pos.row - 1, pos.col]);
    if (isCellActive(board, pos.row, pos.col)) result.push([pos.row, pos.col]);
  } else {
    if (isCellActive(board, pos.row, pos.col - 1)) result.push([pos.row, pos.col - 1]);
    if (isCellActive(board, pos.row, pos.col)) result.push([pos.row, pos.col]);
  }
  return result;
}

export function isBoxComplete(board           , row        , col        )          {
  return (
    board.hLines[row][col] &&
    board.hLines[row + 1][col] &&
    board.vLines[row][col] &&
    board.vLines[row][col + 1]
  );
}

export function getBoxSideCount(board           , row        , col        )         {
  let count = 0;
  if (board.hLines[row][col]) count++;
  if (board.hLines[row + 1][col]) count++;
  if (board.vLines[row][col]) count++;
  if (board.vLines[row][col + 1]) count++;
  return count;
}

export function getAllAvailableLines(board           )            {
  const lines            = [];
  for (let r = 0; r <= board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (isLineAvailable(board, { type: 'h', row: r, col: c })) {
        lines.push({ type: 'h', row: r, col: c });
      }
    }
  }
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c <= board.cols; c++) {
      if (isLineAvailable(board, { type: 'v', row: r, col: c })) {
        lines.push({ type: 'v', row: r, col: c });
      }
    }
  }
  return lines;
}

export function isGameOver(board           )          {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (isCellActive(board, r, c) && board.boxes[r][c] === null) return false;
    }
  }
  return true;
}

export function getScores(board           )                   {
  let s0 = 0, s1 = 0;
  for (const row of board.boxes) {
    for (const b of row) {
      if (b === 0) s0++;
      else if (b === 1) s1++;
    }
  }
  return [s0, s1];
}

export function getWinner(board           )                       {
  if (!isGameOver(board)) return null;
  const [s0, s1] = getScores(board);
  if (s0 > s1) return 0;
  if (s1 > s0) return 1;
  return 'tie';
}



export function getAIMove(board, difficulty) {
  const available = getAllAvailableLines(board);
  if (!available.length) return null;
  if (difficulty === 'easy') return available[Math.floor(Math.random() * available.length)];
  const options = available.map(move => ({move, ...drawLine(board, move, 1)}));
  const most = Math.max(...options.map(o => o.claimedBoxes));
  if (difficulty === 'medium' && most > 0) return options.find(o => o.claimedBoxes === most).move;
  let best = [], bestValue = -Infinity;
  for (const option of options) {
    let reply = 0;
    for (const move of getAllAvailableLines(option.newBoard)) {
      reply = Math.max(reply, drawLine(option.newBoard, move, 0).claimedBoxes);
    }
    const value = option.claimedBoxes - reply;
    if (value > bestValue) { bestValue = value; best = [option.move]; }
    else if (value === bestValue) best.push(option.move);
  }
  return best[Math.floor(Math.random() * best.length)];
}
