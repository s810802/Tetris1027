/**
 * Tetris Game Controller (Pure Vanilla JavaScript)
 * No React, No TypeScript.
 */

import {
  COLS,
  ROWS,
  TETROMINOES,
  COLOR_MAP,
  createBoard,
  createBag,
  checkCollision,
  tryRotate,
  getGhostOffset,
  mergePiece,
  clearLines,
  calculateLineScore,
  getDropInterval,
} from './game/logic.js';

import { sound } from './audio.js';

// Constants
const CELL_SIZE = 30; // 10 cols * 30 = 300px width, 20 rows * 30 = 600px height
const DAS = 150; // Delayed Auto Shift (initial delay ms)
const ARR = 35;  // Auto Repeat Rate (repeat interval ms)
const LOCK_DELAY = 500; // ms before locking on ground
const MAX_LOCK_RESETS = 15;

class TetrisGame {
  constructor() {
    // DOM Elements
    this.canvas = document.getElementById('tetris-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.holdCanvas = document.getElementById('hold-canvas');
    this.holdCtx = this.holdCanvas.getContext('2d');

    this.nextCanvas = document.getElementById('next-canvas');
    this.nextCtx = this.nextCanvas.getContext('2d');

    this.particlesOverlay = document.getElementById('particles-overlay');
    this.canvasContainer = document.getElementById('canvas-container');

    // UI Displays
    this.scoreEl = document.getElementById('score-display');
    this.highScoreEl = document.getElementById('high-score-display');
    this.levelEl = document.getElementById('level-display');
    this.linesEl = document.getElementById('lines-display');
    this.comboContainer = document.getElementById('combo-container');
    this.comboEl = document.getElementById('combo-display');

    // Screens & Modals
    this.pauseScreen = document.getElementById('pause-screen');
    this.gameOverScreen = document.getElementById('game-over-screen');
    this.helpModal = document.getElementById('help-modal');
    this.newRecordBadge = document.getElementById('new-record-badge');

    // Buttons
    this.soundBtn = document.getElementById('btn-sound');
    this.soundIcon = document.getElementById('sound-icon');
    this.soundText = document.getElementById('sound-text');
    this.pauseBtn = document.getElementById('btn-pause');
    this.pauseIcon = document.getElementById('pause-icon');
    this.pauseText = document.getElementById('pause-text');
    this.restartBtn = document.getElementById('btn-restart');
    this.helpBtn = document.getElementById('btn-help');
    this.closeHelpBtn = document.getElementById('btn-close-help');
    this.modalStartBtn = document.getElementById('btn-modal-start');
    this.resumeBtn = document.getElementById('btn-resume');
    this.pauseRestartBtn = document.getElementById('btn-pause-restart');
    this.gameOverRestartBtn = document.getElementById('btn-game-over-restart');

    // Game State
    this.board = createBoard();
    this.bag = [];
    this.nextQueue = [];
    this.currentPiece = null;
    this.holdPiece = null;
    this.canHold = true;

    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('tetris_high_score') || '0', 10);
    this.level = 1;
    this.lines = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.tetrisCount = 0;

    this.dropCounter = 0;
    this.lastTime = 0;
    this.lockCounter = 0;
    this.lockResets = 0;
    this.isOnGround = false;

    this.isPaused = false;
    this.isGameOver = false;
    this.particles = [];

    // Key Repeat States (DAS / ARR)
    this.keysPressed = {};
    this.keyTimers = {};

    this.init();
  }

  init() {
    this.updateSoundButtonUI();
    this.highScoreEl.textContent = this.highScore.toLocaleString();

    this.setupEventListeners();
    this.setupTouchControls();
    this.resetGame();

    // Auto start check
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autostart') === '1') {
      this.isPaused = false;
    }

    // Start Animation Loop
    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  resetGame() {
    this.board = createBoard();
    this.bag = [];
    this.nextQueue = [];
    // Populate initial queue (at least 5 pieces)
    while (this.nextQueue.length < 5) {
      if (this.bag.length === 0) {
        this.bag = createBag();
      }
      this.nextQueue.push(this.bag.pop());
    }

    this.currentPiece = null;
    this.holdPiece = null;
    this.canHold = true;

    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.tetrisCount = 0;

    this.dropCounter = 0;
    this.lockCounter = 0;
    this.lockResets = 0;
    this.isOnGround = false;
    this.isPaused = false;
    this.isGameOver = false;
    this.particles = [];

    this.pauseScreen.classList.add('hidden');
    this.pauseScreen.classList.remove('flex');
    this.gameOverScreen.classList.add('hidden');
    this.gameOverScreen.classList.remove('flex');
    this.newRecordBadge.classList.add('hidden');

    this.updateHUD();
    this.spawnPiece();
    this.drawHold();
    this.drawNext();
  }

  spawnPiece() {
    if (this.nextQueue.length < 5) {
      if (this.bag.length === 0) {
        this.bag = createBag();
      }
      this.nextQueue.push(this.bag.pop());
    }

    const type = this.nextQueue.shift();
    const tetromino = TETROMINOES[type];
    const matrix = tetromino.shape.map((r) => [...r]);

    // Initial position: centered horizontally at top
    const x = Math.floor((COLS - matrix[0].length) / 2);
    const y = type === 'I' ? -1 : 0;

    this.currentPiece = {
      type,
      matrix,
      color: tetromino.color,
      colorDark: tetromino.colorDark,
      colorLight: tetromino.colorLight,
      id: tetromino.id,
      x,
      y,
    };

    this.canHold = true;
    this.lockCounter = 0;
    this.lockResets = 0;
    this.isOnGround = false;

    // Check immediately for game over (block spawned into collision)
    if (checkCollision(this.board, this.currentPiece.matrix, { x: this.currentPiece.x, y: this.currentPiece.y })) {
      this.triggerGameOver();
    }

    this.drawNext();
  }

  hold() {
    if (!this.canHold || this.isPaused || this.isGameOver) return;

    sound.playHold();
    const currentType = this.currentPiece.type;

    if (!this.holdPiece) {
      this.holdPiece = currentType;
      this.spawnPiece();
    } else {
      const prevHold = this.holdPiece;
      this.holdPiece = currentType;

      const tetromino = TETROMINOES[prevHold];
      const matrix = tetromino.shape.map((r) => [...r]);
      const x = Math.floor((COLS - matrix[0].length) / 2);
      const y = prevHold === 'I' ? -1 : 0;

      this.currentPiece = {
        type: prevHold,
        matrix,
        color: tetromino.color,
        colorDark: tetromino.colorDark,
        colorLight: tetromino.colorLight,
        id: tetromino.id,
        x,
        y,
      };

      if (checkCollision(this.board, this.currentPiece.matrix, { x: this.currentPiece.x, y: this.currentPiece.y })) {
        this.triggerGameOver();
      }
    }

    this.canHold = false;
    this.drawHold();
  }

  move(dir) {
    if (this.isPaused || this.isGameOver || !this.currentPiece) return false;

    const newX = this.currentPiece.x + dir;
    if (!checkCollision(this.board, this.currentPiece.matrix, { x: newX, y: this.currentPiece.y })) {
      this.currentPiece.x = newX;
      sound.playMove();

      // Reset lock delay if on ground
      if (this.isOnGround && this.lockResets < MAX_LOCK_RESETS) {
        this.lockCounter = 0;
        this.lockResets++;
      }
      return true;
    }
    return false;
  }

  rotate(dir = 1) {
    if (this.isPaused || this.isGameOver || !this.currentPiece) return;

    // O piece doesn't need rotation
    if (this.currentPiece.type === 'O') return;

    const result = tryRotate(
      this.board,
      this.currentPiece.matrix,
      { x: this.currentPiece.x, y: this.currentPiece.y },
      dir
    );

    if (result.success) {
      this.currentPiece.matrix = result.matrix;
      this.currentPiece.x = result.offset.x;
      this.currentPiece.y = result.offset.y;
      sound.playRotate();

      // Reset lock delay if on ground
      if (this.isOnGround && this.lockResets < MAX_LOCK_RESETS) {
        this.lockCounter = 0;
        this.lockResets++;
      }
    }
  }

  softDrop() {
    if (this.isPaused || this.isGameOver || !this.currentPiece) return;

    const newY = this.currentPiece.y + 1;
    if (!checkCollision(this.board, this.currentPiece.matrix, { x: this.currentPiece.x, y: newY })) {
      this.currentPiece.y = newY;
      this.score += 1; // 1 point per soft drop cell
      this.updateHUD();
      sound.playSoftDrop();
      this.dropCounter = 0;
    } else {
      this.isOnGround = true;
    }
  }

  hardDrop() {
    if (this.isPaused || this.isGameOver || !this.currentPiece) return;

    const ghost = getGhostOffset(this.board, this.currentPiece.matrix, {
      x: this.currentPiece.x,
      y: this.currentPiece.y,
    });

    const dropDistance = ghost.y - this.currentPiece.y;
    this.score += dropDistance * 2; // 2 points per hard drop cell
    this.currentPiece.y = ghost.y;

    sound.playHardDrop();
    this.triggerScreenShake();
    this.spawnDropParticles();
    this.lockPiece();
  }

  lockPiece() {
    if (!this.currentPiece) return;

    this.board = mergePiece(this.board, this.currentPiece.matrix, {
      x: this.currentPiece.x,
      y: this.currentPiece.y,
    });

    // Check for cleared rows
    const { newBoard, linesCleared, clearedIndices } = clearLines(this.board);

    if (linesCleared > 0) {
      this.board = newBoard;
      this.combo++;
      if (this.combo > this.maxCombo) {
        this.maxCombo = this.combo;
      }
      if (linesCleared === 4) {
        this.tetrisCount++;
      }

      const pointsEarned = calculateLineScore(linesCleared, this.level, this.combo);
      this.score += pointsEarned;
      this.lines += linesCleared;

      // Level increases every 10 lines
      const newLevel = Math.floor(this.lines / 10) + 1;
      if (newLevel > this.level) {
        this.level = newLevel;
        sound.playLevelUp();
        this.showFloatingText('LEVEL UP! 🚀', '#c084fc');
      }

      sound.playLineClear(linesCleared);
      this.spawnLineClearParticles(clearedIndices);

      // Show floating text for big clears
      if (linesCleared === 4) {
        this.showFloatingText('TETRIS! + ' + pointsEarned, '#facc15');
      } else if (this.combo > 1) {
        this.showFloatingText(`COMBO x${this.combo} +${pointsEarned}`, '#38bdf8');
      } else {
        this.showFloatingText(`+${pointsEarned}`, '#4ade80');
      }
    } else {
      this.combo = 0;
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('tetris_high_score', String(this.highScore));
    }

    this.updateHUD();
    this.spawnPiece();
  }

  triggerGameOver() {
    this.isGameOver = true;
    sound.playGameOver();

    document.getElementById('final-score').textContent = this.score.toLocaleString();
    document.getElementById('final-lines').textContent = this.lines.toString();
    document.getElementById('final-level').textContent = this.level.toString();
    document.getElementById('final-tetris-count').textContent = this.tetrisCount.toString();
    document.getElementById('final-max-combo').textContent = this.maxCombo.toString();

    if (this.score > 0 && this.score >= this.highScore) {
      this.newRecordBadge.classList.remove('hidden');
    } else {
      this.newRecordBadge.classList.add('hidden');
    }

    this.gameOverScreen.classList.remove('hidden');
    this.gameOverScreen.classList.add('flex');
    this.updateHUD();
  }

  togglePause() {
    if (this.isGameOver) return;
    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.pauseScreen.classList.remove('hidden');
      this.pauseScreen.classList.add('flex');
      this.pauseText.textContent = '繼續';
      this.pauseIcon.textContent = '▶️';
    } else {
      this.pauseScreen.classList.add('hidden');
      this.pauseScreen.classList.remove('flex');
      this.pauseText.textContent = '暫停';
      this.pauseIcon.textContent = '⏸️';
      this.lastTime = performance.now();
    }
  }

  updateHUD() {
    this.scoreEl.textContent = this.score.toLocaleString();
    this.highScoreEl.textContent = this.highScore.toLocaleString();
    this.levelEl.textContent = this.level.toString();
    this.linesEl.textContent = this.lines.toString();

    if (this.combo > 1) {
      this.comboContainer.style.display = 'block';
      this.comboEl.textContent = this.combo.toString();
    } else {
      this.comboContainer.style.display = 'none';
    }

    // Accessible attributes on body/canvas
    document.body.setAttribute('data-state', this.isGameOver ? 'gameover' : this.isPaused ? 'paused' : 'playing');
    document.body.setAttribute('data-score', String(this.score));
    document.body.setAttribute('data-level', String(this.level));
    document.body.setAttribute('data-lines', String(this.lines));
  }

  updateSoundButtonUI() {
    const muted = sound.isMuted();
    this.soundIcon.textContent = muted ? '🔇' : '🔊';
    this.soundText.textContent = muted ? '音效: 關' : '音效: 開';
  }

  triggerScreenShake() {
    this.canvasContainer.classList.remove('shake');
    // Force reflow
    void this.canvasContainer.offsetWidth;
    this.canvasContainer.classList.add('shake');
    setTimeout(() => {
      this.canvasContainer.classList.remove('shake');
    }, 150);
  }

  showFloatingText(text, color = '#facc15') {
    const el = document.createElement('div');
    el.className = 'floating-score';
    el.textContent = text;
    el.style.color = color;
    el.style.left = '50%';
    el.style.top = '40%';
    el.style.transform = 'translate(-50%, -50%)';
    this.particlesOverlay.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  spawnDropParticles() {
    if (!this.currentPiece) return;
    const ghost = getGhostOffset(this.board, this.currentPiece.matrix, {
      x: this.currentPiece.x,
      y: this.currentPiece.y,
    });
    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x: (ghost.x + Math.random() * 3) * CELL_SIZE,
        y: (ghost.y + 2) * CELL_SIZE,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 4 - 1,
        color: this.currentPiece.color,
        size: Math.random() * 3 + 2,
        life: 1,
        decay: Math.random() * 0.05 + 0.04,
      });
    }
  }

  spawnLineClearParticles(clearedRows) {
    clearedRows.forEach((rowIdx) => {
      for (let i = 0; i < 25; i++) {
        this.particles.push({
          x: Math.random() * (COLS * CELL_SIZE),
          y: rowIdx * CELL_SIZE + CELL_SIZE / 2,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          color: ['#00f5ff', '#ffe600', '#bd00ff', '#00ff66', '#ff2a55', '#ffffff'][Math.floor(Math.random() * 6)],
          size: Math.random() * 4 + 2,
          life: 1,
          decay: Math.random() * 0.03 + 0.02,
        });
      }
    });
  }

  // --- RENDERING ---
  drawCell(ctx, x, y, color, colorDark, colorLight, size = CELL_SIZE, alpha = 1) {
    const px = x * size;
    const py = y * size;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Base square
    ctx.fillStyle = color;
    ctx.fillRect(px, py, size, size);

    // Bevel highlights & shadow
    ctx.fillStyle = colorLight || 'rgba(255, 255, 255, 0.4)';
    // Top highlight
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + size, py);
    ctx.lineTo(px + size - 3, py + 3);
    ctx.lineTo(px + 3, py + 3);
    ctx.fill();

    // Left highlight
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 3, py + 3);
    ctx.lineTo(px + 3, py + size - 3);
    ctx.lineTo(px, py + size);
    ctx.fill();

    // Bottom dark shadow
    ctx.fillStyle = colorDark || 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.moveTo(px, py + size);
    ctx.lineTo(px + 3, py + size - 3);
    ctx.lineTo(px + size - 3, py + size - 3);
    ctx.lineTo(px + size, py + size);
    ctx.fill();

    // Right dark shadow
    ctx.beginPath();
    ctx.moveTo(px + size, py);
    ctx.lineTo(px + size - 3, py + 3);
    ctx.lineTo(px + size - 3, py + size - 3);
    ctx.lineTo(px + size, py + size);
    ctx.fill();

    // Inner bevel border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);

    ctx.restore();
  }

  drawGhostCell(ctx, x, y, color, size = CELL_SIZE) {
    const px = x * size;
    const py = y * size;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.12;
    ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
    ctx.restore();
  }

  drawBoard() {
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear background
    this.ctx.fillStyle = '#060911';
    this.ctx.fillRect(0, 0, width, height);

    // Subtle Grid lines
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    this.ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      this.ctx.beginPath();
      this.ctx.moveTo(c * CELL_SIZE, 0);
      this.ctx.lineTo(c * CELL_SIZE, height);
      this.ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, r * CELL_SIZE);
      this.ctx.lineTo(width, r * CELL_SIZE);
      this.ctx.stroke();
    }

    // Render placed blocks
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const id = this.board[y][x];
        if (id !== 0) {
          const t = COLOR_MAP[id];
          if (t) {
            this.drawCell(this.ctx, x, y, t.color, t.colorDark, t.colorLight);
          }
        }
      }
    }

    // Render Ghost Piece
    if (this.currentPiece && !this.isGameOver) {
      const ghost = getGhostOffset(this.board, this.currentPiece.matrix, {
        x: this.currentPiece.x,
        y: this.currentPiece.y,
      });

      for (let y = 0; y < this.currentPiece.matrix.length; y++) {
        for (let x = 0; x < this.currentPiece.matrix[y].length; x++) {
          if (this.currentPiece.matrix[y][x] !== 0) {
            const gy = ghost.y + y;
            const gx = ghost.x + x;
            if (gy >= 0) {
              this.drawGhostCell(this.ctx, gx, gy, this.currentPiece.color);
            }
          }
        }
      }

      // Render Active Piece
      for (let y = 0; y < this.currentPiece.matrix.length; y++) {
        for (let x = 0; x < this.currentPiece.matrix[y].length; x++) {
          if (this.currentPiece.matrix[y][x] !== 0) {
            const py = this.currentPiece.y + y;
            const px = this.currentPiece.x + x;
            if (py >= 0) {
              this.drawCell(
                this.ctx,
                px,
                py,
                this.currentPiece.color,
                this.currentPiece.colorDark,
                this.currentPiece.colorLight
              );
            }
          }
        }
      }
    }

    // Render Particle Explosions
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18; // gravity
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 6;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  drawHold() {
    const ctx = this.holdCtx;
    ctx.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);

    if (!this.holdPiece) return;

    const t = TETROMINOES[this.holdPiece];
    const matrix = t.shape;
    const miniSize = 18;
    const offsetX = (this.holdCanvas.width - matrix[0].length * miniSize) / 2;
    const offsetY = (this.holdCanvas.height - matrix.length * miniSize) / 2;

    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (matrix[y][x] !== 0) {
          const alpha = this.canHold ? 1 : 0.4;
          this.drawCell(
            ctx,
            (offsetX + x * miniSize) / miniSize,
            (offsetY + y * miniSize) / miniSize,
            t.color,
            t.colorDark,
            t.colorLight,
            miniSize,
            alpha
          );
        }
      }
    }
  }

  drawNext() {
    const ctx = this.nextCtx;
    ctx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);

    const miniSize = 18;
    const displayCount = Math.min(3, this.nextQueue.length);

    for (let i = 0; i < displayCount; i++) {
      const type = this.nextQueue[i];
      const t = TETROMINOES[type];
      const matrix = t.shape;
      const pieceY = 12 + i * 65;
      const offsetX = (this.nextCanvas.width - matrix[0].length * miniSize) / 2;

      for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
          if (matrix[y][x] !== 0) {
            this.drawCell(
              ctx,
              (offsetX + x * miniSize) / miniSize,
              (pieceY + y * miniSize) / miniSize,
              t.color,
              t.colorDark,
              t.colorLight,
              miniSize
            );
          }
        }
      }
    }
  }

  // --- GAME LOOP ---
  gameLoop(currentTime = 0) {
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    if (!this.isPaused && !this.isGameOver && this.currentPiece) {
      this.dropCounter += deltaTime;
      const dropInterval = getDropInterval(this.level);

      // Check ground contact for lock delay
      const isTouchingDown = checkCollision(this.board, this.currentPiece.matrix, {
        x: this.currentPiece.x,
        y: this.currentPiece.y + 1,
      });

      this.isOnGround = isTouchingDown;

      if (isTouchingDown) {
        this.lockCounter += deltaTime;
        if (this.lockCounter >= LOCK_DELAY) {
          this.lockPiece();
        }
      } else {
        this.lockCounter = 0;
      }

      // Natural gravity drop
      if (this.dropCounter > dropInterval) {
        if (!isTouchingDown) {
          this.currentPiece.y++;
        }
        this.dropCounter = 0;
      }
    }

    this.drawBoard();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  // --- CONTROLLER & EVENT LISTENERS ---
  setupEventListeners() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      // Prevent browser scroll for game controls
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(e.key)) {
        e.preventDefault();
      }

      if (e.repeat) return; // Handled by DAS/ARR below

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.startKeyRepeat('left', () => this.move(-1));
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.startKeyRepeat('right', () => this.move(1));
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.startKeyRepeat('down', () => this.softDrop());
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
        case 'x':
        case 'X':
          this.rotate(1); // Clockwise
          break;
        case 'z':
        case 'Z':
        case 'Control':
          this.rotate(-1); // Counter-Clockwise
          break;
        case ' ':
          this.hardDrop();
          break;
        case 'c':
        case 'C':
        case 'Shift':
          this.hold();
          break;
        case 'p':
        case 'P':
        case 'Escape':
          this.togglePause();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.stopKeyRepeat('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.stopKeyRepeat('right');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.stopKeyRepeat('down');
          break;
      }
    });

    // Top action buttons
    this.soundBtn.addEventListener('click', () => {
      sound.toggleMute();
      this.updateSoundButtonUI();
    });

    this.pauseBtn.addEventListener('click', () => this.togglePause());
    this.restartBtn.addEventListener('click', () => this.resetGame());
    this.resumeBtn.addEventListener('click', () => this.togglePause());
    this.pauseRestartBtn.addEventListener('click', () => this.resetGame());
    this.gameOverRestartBtn.addEventListener('click', () => this.resetGame());

    // Help dialog
    this.helpBtn.addEventListener('click', () => {
      if (!this.isPaused && !this.isGameOver) {
        this.togglePause();
      }
      this.helpModal.showModal();
    });

    this.closeHelpBtn.addEventListener('click', () => {
      this.helpModal.close();
    });

    this.modalStartBtn.addEventListener('click', () => {
      this.helpModal.close();
      if (this.isPaused) {
        this.togglePause();
      }
    });
  }

  startKeyRepeat(key, action) {
    this.stopKeyRepeat(key);
    action(); // Immediate trigger

    this.keyTimers[key] = {
      dasTimeout: setTimeout(() => {
        this.keyTimers[key].arrInterval = setInterval(() => {
          action();
        }, ARR);
      }, DAS),
    };
  }

  stopKeyRepeat(key) {
    if (this.keyTimers[key]) {
      clearTimeout(this.keyTimers[key].dasTimeout);
      clearInterval(this.keyTimers[key].arrInterval);
      delete this.keyTimers[key];
    }
  }

  setupTouchControls() {
    const bindTouchAction = (btnId, onTrigger, isRepeatable = false) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;

      let intervalId = null;
      let timeoutId = null;

      const start = (e) => {
        e.preventDefault();
        btn.classList.add('active-touch');
        if (navigator.vibrate) {
          try { navigator.vibrate(15); } catch {}
        }
        onTrigger();

        if (isRepeatable) {
          timeoutId = setTimeout(() => {
            intervalId = setInterval(() => {
              onTrigger();
            }, ARR + 10);
          }, DAS);
        }
      };

      const stop = (e) => {
        e.preventDefault();
        btn.classList.remove('active-touch');
        clearTimeout(timeoutId);
        clearInterval(intervalId);
      };

      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', stop, { passive: false });
      btn.addEventListener('touchcancel', stop, { passive: false });
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', stop);
      btn.addEventListener('mouseleave', stop);
    };

    bindTouchAction('touch-left', () => this.move(-1), true);
    bindTouchAction('touch-right', () => this.move(1), true);
    bindTouchAction('touch-down', () => this.softDrop(), true);
    bindTouchAction('touch-hard-drop', () => this.hardDrop(), false);
    bindTouchAction('touch-rot-cw', () => this.rotate(1), false);
    bindTouchAction('touch-rot-ccw', () => this.rotate(-1), false);
    bindTouchAction('touch-hold', () => this.hold(), false);

    // Swipe gestures on main canvas
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          touchStartTime = performance.now();
        }
      },
      { passive: true }
    );

    this.canvas.addEventListener(
      'touchend',
      (e) => {
        if (e.changedTouches.length === 1) {
          const deltaX = e.changedTouches[0].clientX - touchStartX;
          const deltaY = e.changedTouches[0].clientY - touchStartY;
          const duration = performance.now() - touchStartTime;

          const absX = Math.abs(deltaX);
          const absY = Math.abs(deltaY);

          // Fast flick down -> Hard drop
          if (deltaY > 60 && absY > absX * 1.5 && duration < 250) {
            this.hardDrop();
            return;
          }

          // Tap without drag -> Rotate
          if (absX < 12 && absY < 12 && duration < 200) {
            this.rotate(1);
            return;
          }

          // Horizontal swipe
          if (absX > 25 && absX > absY) {
            if (deltaX > 0) this.move(1);
            else this.move(-1);
          } else if (deltaY > 25) {
            // Soft drop
            this.softDrop();
          } else if (deltaY < -25) {
            // Swipe up -> Hold
            this.hold();
          }
        }
      },
      { passive: true }
    );
  }
}

// Instantiate game on DOM ready
let gameInstance = null;
function initApp() {
  if (!gameInstance && document.getElementById('tetris-canvas')) {
    gameInstance = new TetrisGame();
  }
}

document.addEventListener('DOMContentLoaded', initApp);
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initApp();
}

