                                 
                                                                     
                                              

                            
               
               
                    
                          
                      
                      
                                  
                                  
                             
 

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

  return { newBoard, claimedBoxes };
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

                                                    

export function getAIMove(board           , difficulty            )                 {
  const available = getAllAvailableLines(board);
  if (available.length === 0) return null;

  if (difficulty === 'easy') {
    return available[Math.floor(Math.random() * available.length)];
  }

  const captureMoves            = [];
  for (const pos of available) {
    const adj = getAdjacentBoxes(board, pos);
    if (adj.some(([r, c]) => board.boxes[r][c] === null && getBoxSideCount(board, r, c) === 3)) {
      captureMoves.push(pos);
    }
  }
  if (captureMoves.length > 0) return captureMoves[0];

  const safeMoves = available.filter(pos => {
    const { newBoard } = drawLine(board, pos, 1);
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        if (!isCellActive(board, r, c)) continue;
        if (newBoard.boxes[r][c] === null && getBoxSideCount(newBoard, r, c) === 3) return false;
      }
    }
    return true;
  });

  if (safeMoves.length > 0) {
    return safeMoves[Math.floor(Math.random() * safeMoves.length)];
  }

  if (difficulty === 'hard') {
    let bestMove = available[0];
    let minDanger = Infinity;
    for (const pos of available) {
      const { newBoard } = drawLine(board, pos, 1);
      let danger = 0;
      for (let r = 0; r < board.rows; r++) {
        for (let c = 0; c < board.cols; c++) {
          if (!isCellActive(board, r, c)) continue;
          if (newBoard.boxes[r][c] === null && getBoxSideCount(newBoard, r, c) === 3) danger++;
        }
      }
      if (danger < minDanger) { minDanger = danger; bestMove = pos; }
    }
    return bestMove;
  }

  return available[Math.floor(Math.random() * available.length)];
}
