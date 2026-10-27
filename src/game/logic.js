/**
 * Pure Tetris Game Logic (Vanilla JavaScript)
 * Decoupled from DOM/Rendering for testability and clean architecture.
 */

export const COLS = 10;
export const ROWS = 20;

export const TETROMINOES = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    color: '#00f5ff', // Neon Cyan
    colorDark: '#008b8b',
    colorLight: '#e0ffff',
    id: 1,
    name: 'I',
  },
  O: {
    shape: [
      [2, 2],
      [2, 2],
    ],
    color: '#ffe600', // Neon Yellow
    colorDark: '#b8860b',
    colorLight: '#ffffe0',
    id: 2,
    name: 'O',
  },
  T: {
    shape: [
      [0, 3, 0],
      [3, 3, 3],
      [0, 0, 0],
    ],
    color: '#bd00ff', // Neon Purple
    colorDark: '#6a0dad',
    colorLight: '#f3e5f5',
    id: 3,
    name: 'T',
  },
  S: {
    shape: [
      [0, 4, 4],
      [4, 4, 0],
      [0, 0, 0],
    ],
    color: '#00ff66', // Neon Green
    colorDark: '#008000',
    colorLight: '#e8f5e9',
    id: 4,
    name: 'S',
  },
  Z: {
    shape: [
      [5, 5, 0],
      [0, 5, 5],
      [0, 0, 0],
    ],
    color: '#ff2a55', // Neon Red
    colorDark: '#8b0000',
    colorLight: '#ffebee',
    id: 5,
    name: 'Z',
  },
  J: {
    shape: [
      [6, 0, 0],
      [6, 6, 6],
      [0, 0, 0],
    ],
    color: '#0066ff', // Neon Blue
    colorDark: '#00008b',
    colorLight: '#e3f2fd',
    id: 6,
    name: 'J',
  },
  L: {
    shape: [
      [0, 0, 7],
      [7, 7, 7],
      [0, 0, 0],
    ],
    color: '#ff9900', // Neon Orange
    colorDark: '#cc6600',
    colorLight: '#fff3e0',
    id: 7,
    name: 'L',
  },
};

export const COLOR_MAP = {
  1: TETROMINOES.I,
  2: TETROMINOES.O,
  3: TETROMINOES.T,
  4: TETROMINOES.S,
  5: TETROMINOES.Z,
  6: TETROMINOES.J,
  7: TETROMINOES.L,
};

/**
 * Creates an empty game board of given rows and columns.
 */
export function createBoard(rows = ROWS, cols = COLS) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

/**
 * Deep clone a 2D matrix or board.
 */
export function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

/**
 * Generates a standard 7-bag of randomized pieces.
 */
export function createBag() {
  const pieces = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  // Fisher-Yates shuffle
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  return pieces;
}

/**
 * Rotate a square/rectangle matrix clockwise or counter-clockwise.
 * @param {number[][]} matrix
 * @param {number} dir 1 for clockwise, -1 for counter-clockwise
 */
export function rotateMatrix(matrix, dir = 1) {
  const N = matrix.length;
  const result = Array.from({ length: N }, () => Array(N).fill(0));

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (dir > 0) {
        // Clockwise: new [x][N - 1 - y] = old [y][x]
        result[x][N - 1 - y] = matrix[y][x];
      } else {
        // Counter-clockwise: new [N - 1 - x][y] = old [y][x]
        result[N - 1 - x][y] = matrix[y][x];
      }
    }
  }
  return result;
}

/**
 * Checks if a piece collides with the board boundaries or placed blocks.
 */
export function checkCollision(board, matrix, offset) {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (matrix[y][x] !== 0) {
        const boardX = offset.x + x;
        const boardY = offset.y + y;

        // Check horizontal boundaries
        if (boardX < 0 || boardX >= (board[0]?.length ?? COLS)) {
          return true;
        }

        // Check bottom boundary
        if (boardY >= board.length) {
          return true;
        }

        // Check collision with existing blocks (allow above ceiling boardY < 0)
        if (boardY >= 0 && board[boardY][boardX] !== 0) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Attempts to rotate a piece with basic wall-kick offsets.
 */
export function tryRotate(board, pieceMatrix, offset, dir = 1) {
  const rotated = rotateMatrix(pieceMatrix, dir);

  // Common kick offsets to test: [dx, dy]
  const kickOffsets = [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: -2, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: -1 },
    { x: 1, y: -1 },
  ];

  for (const kick of kickOffsets) {
    const testOffset = {
      x: offset.x + kick.x,
      y: offset.y + kick.y,
    };
    if (!checkCollision(board, rotated, testOffset)) {
      return {
        success: true,
        matrix: rotated,
        offset: testOffset,
      };
    }
  }

  return { success: false, matrix: pieceMatrix, offset };
}

/**
 * Computes the ghost piece position (lowest valid y offset).
 */
export function getGhostOffset(board, matrix, offset) {
  let ghostY = offset.y;
  while (!checkCollision(board, matrix, { x: offset.x, y: ghostY + 1 })) {
    ghostY++;
  }
  return { x: offset.x, y: ghostY };
}

/**
 * Merges a piece into the board.
 */
export function mergePiece(board, matrix, offset) {
  const newBoard = cloneMatrix(board);
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (matrix[y][x] !== 0) {
        const boardY = offset.y + y;
        const boardX = offset.x + x;
        if (boardY >= 0 && boardY < newBoard.length && boardX >= 0 && boardX < newBoard[0].length) {
          newBoard[boardY][boardX] = matrix[y][x];
        }
      }
    }
  }
  return newBoard;
}

/**
 * Clears full rows and returns cleared info + new board.
 */
export function clearLines(board) {
  const clearedIndices = [];
  const cols = board[0].length;

  for (let y = 0; y < board.length; y++) {
    if (board[y].every((cell) => cell !== 0)) {
      clearedIndices.push(y);
    }
  }

  if (clearedIndices.length === 0) {
    return {
      newBoard: board,
      linesCleared: 0,
      clearedIndices: [],
    };
  }

  const remainingRows = board.filter((_, idx) => !clearedIndices.includes(idx));
  const newRows = Array.from({ length: clearedIndices.length }, () => Array(cols).fill(0));
  const newBoard = [...newRows, ...remainingRows];

  return {
    newBoard,
    linesCleared: clearedIndices.length,
    clearedIndices,
  };
}

/**
 * Calculates score earned for clearing lines and combos.
 */
export function calculateLineScore(linesCleared, level = 1, combo = 0) {
  const baseScores = [0, 100, 300, 500, 800]; // 1, 2, 3, 4 lines
  const base = baseScores[linesCleared] || 0;
  const lineScore = base * level;
  const comboBonus = combo > 0 ? 50 * combo * level : 0;
  return lineScore + comboBonus;
}

/**
 * Calculates drop interval (in milliseconds) based on current level.
 */
export function getDropInterval(level = 1) {
  // Speed curve: starts at 800ms, decreases smoothly, min 80ms
  return Math.max(80, Math.floor(800 * Math.pow(0.85, level - 1)));
}
