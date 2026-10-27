import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBoard,
  rotateMatrix,
  checkCollision,
  mergePiece,
  clearLines,
  calculateLineScore,
  getGhostOffset,
  getDropInterval,
  createBag,
  TETROMINOES,
  COLS,
  ROWS,
} from './logic.js';

test('createBoard creates a grid of ROWS x COLS filled with 0', () => {
  const board = createBoard(20, 10);
  assert.equal(board.length, 20);
  assert.equal(board[0].length, 10);
  assert.equal(board.every((row) => row.every((c) => c === 0)), true);
});

test('createBag returns all 7 tetromino shapes exactly once', () => {
  const bag = createBag();
  assert.equal(bag.length, 7);
  const unique = new Set(bag);
  assert.equal(unique.size, 7);
  ['I', 'O', 'T', 'S', 'Z', 'J', 'L'].forEach((type) => {
    assert.equal(unique.has(type), true);
  });
});

test('rotateMatrix rotates a 3x3 matrix correctly (T piece)', () => {
  const tMatrix = [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ];
  const cw = rotateMatrix(tMatrix, 1);
  assert.deepEqual(cw, [
    [0, 1, 0],
    [0, 1, 1],
    [0, 1, 0],
  ]);

  const ccw = rotateMatrix(cw, -1);
  assert.deepEqual(ccw, tMatrix);
});

test('checkCollision detects boundaries', () => {
  const board = createBoard(ROWS, COLS);
  const matrix = TETROMINOES.O.shape; // 2x2

  // Inside board
  assert.equal(checkCollision(board, matrix, { x: 0, y: 0 }), false);
  assert.equal(checkCollision(board, matrix, { x: 8, y: 18 }), false);

  // Left boundary
  assert.equal(checkCollision(board, matrix, { x: -1, y: 0 }), true);

  // Right boundary (O is 2 wide, x=9 puts it partially at x=10)
  assert.equal(checkCollision(board, matrix, { x: 9, y: 0 }), true);

  // Bottom boundary (board height 20, y=19 puts it at 19 and 20)
  assert.equal(checkCollision(board, matrix, { x: 0, y: 19 }), true);
});

test('mergePiece and checkCollision detect block overlaps', () => {
  let board = createBoard(ROWS, COLS);
  const matrix = TETROMINOES.O.shape;

  // Place at bottom left
  board = mergePiece(board, matrix, { x: 0, y: 18 });
  assert.equal(board[18][0], 2);
  assert.equal(board[18][1], 2);
  assert.equal(board[19][0], 2);
  assert.equal(board[19][1], 2);

  // Trying to place another piece overlapping should collide
  assert.equal(checkCollision(board, matrix, { x: 0, y: 18 }), true);
  // Placing right above should succeed
  assert.equal(checkCollision(board, matrix, { x: 0, y: 16 }), false);
});

test('getGhostOffset calculates where piece lands on floor or stack', () => {
  let board = createBoard(ROWS, COLS);
  const matrix = TETROMINOES.O.shape; // 2x2

  // On empty board, floor is y=18
  const ghostEmpty = getGhostOffset(board, matrix, { x: 3, y: 0 });
  assert.deepEqual(ghostEmpty, { x: 3, y: 18 });

  // Add block at row 15, col 3
  board[15][3] = 1;
  const ghostStack = getGhostOffset(board, matrix, { x: 3, y: 0 });
  // O piece row 1 is at y+1. So if y=14, row 1 is at 15 -> collision! So y should be 13
  assert.deepEqual(ghostStack, { x: 3, y: 13 });
});

test('clearLines clears full rows and pushes empty rows at top', () => {
  let board = createBoard(4, 4);
  board[3] = [1, 1, 1, 1]; // Full line
  board[2] = [2, 0, 2, 2]; // Incomplete line
  board[1] = [3, 3, 3, 3]; // Full line

  const result = clearLines(board);
  assert.equal(result.linesCleared, 2);
  assert.deepEqual(result.clearedIndices, [1, 3]);

  // Board height must still be 4
  assert.equal(result.newBoard.length, 4);
  // Top two rows should be empty
  assert.deepEqual(result.newBoard[0], [0, 0, 0, 0]);
  assert.deepEqual(result.newBoard[1], [0, 0, 0, 0]);
  // The incomplete line should have dropped to bottom row
  assert.deepEqual(result.newBoard[3], [2, 0, 2, 2]);
});

test('calculateLineScore rewards multi-lines and combos', () => {
  assert.equal(calculateLineScore(1, 1, 0), 100);
  assert.equal(calculateLineScore(2, 1, 0), 300);
  assert.equal(calculateLineScore(3, 1, 0), 500);
  assert.equal(calculateLineScore(4, 1, 0), 800); // Tetris!

  // Level 2
  assert.equal(calculateLineScore(4, 2, 0), 1600);

  // Combo bonus
  assert.equal(calculateLineScore(1, 1, 2), 100 + 50 * 2 * 1);
});

test('getDropInterval speeds up as level increases but stays >= 80ms', () => {
  const l1 = getDropInterval(1);
  const l5 = getDropInterval(5);
  const l20 = getDropInterval(20);

  assert.equal(l1, 800);
  assert.equal(l5 < l1, true);
  assert.equal(l20, 80);
});
