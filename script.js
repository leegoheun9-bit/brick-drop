const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-piece');
const nextContext = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-piece');
const holdContext = holdCanvas.getContext('2d');

const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const finalScoreElement = document.getElementById('final-score');
const modal = document.getElementById('game-over-modal');
const restartBtn = document.getElementById('restart-btn');
const startBtn = document.getElementById('start-btn');
const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
const saveScoreBtn = document.getElementById('save-score-btn');
const playerNameInput = document.getElementById('player-name');
const leaderboardDiv = document.getElementById('leaderboard');
const highScoresList = document.getElementById('high-scores-list');
const highScoreForm = document.getElementById('high-score-form');

// Scale everything
context.scale(20, 20);
nextContext.scale(20, 20);
holdContext.scale(20, 20);

// Tetromino definitions
const SHAPES = 'ILJOTSZ';
const COLORS = [
    null,
    '#FF0D72', // T
    '#0DC2FF', // O
    '#0DFF72', // L
    '#F538FF', // J
    '#FF8E0D', // I
    '#FFE138', // S
    '#3877FF', // Z
];

// Adjust colors to be more neon
const NEON_COLORS = [
    null,
    '#FF0055', // T - Red/Pink
    '#00FFFF', // O - Cyan
    '#00FF00', // L - Green
    '#AA00FF', // J - Purple
    '#FFAA00', // I - Orange
    '#FFFF00', // S - Yellow
    '#0055FF', // Z - Blue
];

function createPiece(type) {
    // This function is kept for reference or if we need fresh matrices, 
    // but getPieceMatrix handles the actual structure used.
    return getPieceMatrix(type);
}

function getPieceMatrix(type) {
    if (type === 'I') return [[0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0]];
    if (type === 'L') return [[0, 3, 0], [0, 3, 0], [0, 3, 3]];
    if (type === 'J') return [[0, 4, 0], [0, 4, 0], [4, 4, 0]];
    if (type === 'O') return [[2, 2], [2, 2]];
    if (type === 'Z') return [[7, 7, 0], [0, 7, 7], [0, 0, 0]];
    if (type === 'S') return [[0, 6, 6], [6, 6, 0], [0, 0, 0]];
    if (type === 'T') return [[0, 1, 0], [1, 1, 1], [0, 0, 0]];
}

const levelUpModal = document.getElementById('level-up-modal');

// Sound Manager using Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const sounds = {
    move: { type: 'triangle', freq: 400, duration: 0.05, vol: 0.1 },
    rotate: { type: 'sine', freq: 600, duration: 0.05, vol: 0.1 },
    drop: { type: 'square', freq: 200, duration: 0.05, vol: 0.1 },
    clear: { type: 'sine', freq: 800, duration: 0.2, vol: 0.2, slide: true },
    levelUp: { type: 'triangle', freq: 600, duration: 0.5, vol: 0.3, melody: true },
    gameOver: { type: 'sawtooth', freq: 100, duration: 1.0, vol: 0.3, slideDown: true }
};

function playSound(name) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const sound = sounds[name];
    if (!sound) return;

    if (name === 'levelUp') {
        playLevelUpMelody();
        return;
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = sound.type;
    osc.frequency.setValueAtTime(sound.freq, audioCtx.currentTime);

    if (sound.slide) {
        osc.frequency.exponentialRampToValueAtTime(sound.freq * 2, audioCtx.currentTime + sound.duration);
    }
    if (sound.slideDown) {
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + sound.duration);
    }

    gain.gain.setValueAtTime(sound.vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + sound.duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + sound.duration);
}

function playLevelUpMelody() {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C E G C
    let time = audioCtx.currentTime;

    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(time);
        osc.stop(time + 0.15);
        time += 0.1;
    });
}

// BGM Music (Simple Loop)
let bgmGainNode = null;
let bgmIsPlaying = false;
let bgmNotes = []; // To store active oscillators

function startBGM() {
    if (bgmIsPlaying) return;
    bgmIsPlaying = true;

    // Create a master gain for BGM
    bgmGainNode = audioCtx.createGain();
    bgmGainNode.gain.value = 0.05; // Low volume background
    bgmGainNode.connect(audioCtx.destination);

    const bassFreqs = [110, 110, 130.81, 98]; // A2, A2, C3, G2
    const leadFreqs = [440, 523.25, 659.25, 523.25]; // A4, C5, E5, C5

    let noteIndex = 0;

    // Use setTimeout loop which is easy to control
    function playNextNote() {
        if (!bgmIsPlaying) return;

        const time = audioCtx.currentTime;
        const noteDuration = 0.25; // 16th note approx

        // Bass
        const bassOsc = audioCtx.createOscillator();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(bassFreqs[Math.floor(noteIndex / 4) % bassFreqs.length], time);

        const bassGain = audioCtx.createGain();
        bassGain.gain.setValueAtTime(0.1, time);
        bassGain.gain.exponentialRampToValueAtTime(0.01, time + noteDuration);

        bassOsc.connect(bassGain);
        bassGain.connect(bgmGainNode);
        bassOsc.start(time);
        bassOsc.stop(time + noteDuration);

        // Lead (every 2 steps)
        if (noteIndex % 2 === 0) {
            const leadOsc = audioCtx.createOscillator();
            leadOsc.type = 'sine';
            leadOsc.frequency.setValueAtTime(leadFreqs[Math.floor(noteIndex / 8) % leadFreqs.length], time);

            const leadGain = audioCtx.createGain();
            leadGain.gain.setValueAtTime(0.05, time);
            leadGain.gain.exponentialRampToValueAtTime(0.01, time + noteDuration * 2);

            leadOsc.connect(leadGain);
            leadGain.connect(bgmGainNode);
            leadOsc.start(time);
            leadOsc.stop(time + noteDuration * 2);
        }

        noteIndex++;

        // Schedule next call
        setTimeout(playNextNote, noteDuration * 1000);
    }

    playNextNote();
}

function stopBGM() {
    bgmIsPlaying = false;
    if (bgmGainNode) {
        bgmGainNode.disconnect();
        bgmGainNode = null;
    }
}

// Particle System
const particles = [];

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        // Random velocity
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.alpha = 1;
        this.size = Math.random() * 0.3 + 0.1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= 0.02; // Fade out
    }

    draw(ctx) {
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1;
    }
}

function spawnFireworks(y, count = 20) {
    for (let i = 0; i < count; i++) {
        const x = Math.random() * 12; // Random x across board
        const color = NEON_COLORS[Math.floor(Math.random() * (NEON_COLORS.length - 1)) + 1];
        particles.push(new Particle(x, y, color));
    }
}


function arenaSweep() {
    let rowCount = 1;
    let cleared = false;
    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) {
                continue outer;
            }
        }

        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;

        player.score += rowCount * 10;
        rowCount *= 2;
        cleared = true;
        spawnFireworks(y, 30); // Spawn fireworks at the cleared line
    }
    if (cleared) {
        playSound('clear');
        updateScore();
    }
}

function collide(arena, player) {
    const m = player.matrix;
    const o = player.pos;
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
                (arena[y + o.y] &&
                    arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

function getGhostY(arena, player) {
    const ghost = {
        pos: { ...player.pos },
        matrix: player.matrix
    };
    while (!collide(arena, ghost)) {
        ghost.pos.y++;
    }
    return ghost.pos.y - 1;
}

function draw() {
    context.fillStyle = '#000'; // Or transparent to see background
    context.clearRect(0, 0, canvas.width, canvas.height);

    drawMatrix(arena, { x: 0, y: 0 });

    if (!isGameOver && isGameStarted) {
        // Draw Ghost Piece
        // Ghost Piece removed
        // const ghostPos = { x: player.pos.x, y: getGhostY(arena, player) };
        // drawMatrix(player.matrix, ghostPos, true);

        drawMatrix(player.matrix, player.pos);
    }

    // Draw and update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw(context);
        if (particles[i].alpha <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawMatrix(matrix, offset, ghost = false) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                if (ghost) {
                    context.fillStyle = 'rgba(255, 255, 255, 0.05)';
                    context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    context.lineWidth = 0.05;
                    context.shadowBlur = 0;

                    context.fillRect(x + offset.x, y + offset.y, 1, 1);
                    context.strokeRect(x + offset.x, y + offset.y, 1, 1);
                } else {
                    context.fillStyle = NEON_COLORS[value];
                    context.shadowBlur = 15;
                    context.shadowColor = NEON_COLORS[value];
                    context.fillRect(x + offset.x, y + offset.y, 1, 1);

                    // Add a small inner bevel for 3D effect
                    context.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    context.shadowBlur = 0;
                    context.fillRect(x + offset.x, y + offset.y, 1, 0.1);
                    context.fillRect(x + offset.x, y + offset.y, 0.1, 1);
                }
            }
        });
    });
}

function drawNextPiece() {
    nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);

    // Draw 3 pieces from nextPieces array (contains type strings)
    nextPieces.forEach((type, index) => {
        const piece = getPieceMatrix(type);
        const offsetY = index * 4 + 1; // Spacing
        const offsetX = (4 - piece.length) / 2;

        piece.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    nextContext.fillStyle = NEON_COLORS[value];
                    nextContext.shadowBlur = 10;
                    nextContext.shadowColor = NEON_COLORS[value];
                    nextContext.fillRect(x + offsetX, y + offsetY, 1, 1);
                }
            });
        });
    });
}

function drawHoldPiece() {
    holdContext.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
    if (!player.hold) return;

    const piece = getPieceMatrix(player.hold);
    const offsetY = 1;
    const offsetX = (4 - piece.length) / 2;

    piece.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                holdContext.fillStyle = NEON_COLORS[value];
                holdContext.shadowBlur = 10;
                holdContext.shadowColor = NEON_COLORS[value];
                holdContext.fillRect(x + offsetX, y + offsetY, 1, 1);
            }
        });
    });
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playSound('drop');
        playerReset();
        arenaSweep();
        canHold = true; // Enable hold again after drop
    }
    dropCounter = 0;
}

function playerHardDrop() {
    while (!collide(arena, player)) {
        player.pos.y++;
    }
    player.pos.y--;
    merge(arena, player);
    playSound('drop');
    playerReset();
    arenaSweep();
    dropCounter = 0;
    canHold = true; // Enable hold again after drop
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) {
        player.pos.x -= dir;
    } else {
        playSound('move');
    }
}

function playerReset() {
    // Fill queue if empty or initializing
    while (nextPieces.length < 3) {
        nextPieces.push(SHAPES[SHAPES.length * Math.random() | 0]);
    }

    const type = nextPieces.shift();
    player.matrix = getPieceMatrix(type);
    player.type = type; // Track current type

    // Add one more to the end
    nextPieces.push(SHAPES[SHAPES.length * Math.random() | 0]);

    drawNextPiece();

    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) -
        (player.matrix[0].length / 2 | 0);

    if (collide(arena, player)) {
        gameOver();
    }
}

function playerHold() {
    if (!canHold || isGameOver || !isGameStarted || isPaused) return;

    const currentType = player.type;

    if (!player.hold) {
        // No piece stored yet
        player.hold = currentType;
        playerReset();
    } else {
        // Swap
        const temp = player.hold;
        player.hold = currentType;
        player.type = temp;
        player.matrix = getPieceMatrix(temp);

        // Reset position to top center
        player.pos.y = 0;
        player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    }

    canHold = false;
    drawHoldPiece();
    playSound('move'); // Sound feedback
}


function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
    playSound('rotate');
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [
                matrix[x][y],
                matrix[y][x],
            ] = [
                    matrix[y][x],
                    matrix[x][y],
                ];
        }
    }

    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let lastLevel = 1;

let isGameStarted = false;
let isPaused = false;
let isGameOver = false;


function update(time = 0) {
    if (!isGameStarted || isPaused || isGameOver) {
        requestAnimationFrame(update);
        return;
    }

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        player.pos.y++;
        if (collide(arena, player)) {
            player.pos.y--;
            merge(arena, player);
            playSound('drop');
            playerReset();
            arenaSweep();
            canHold = true;
        }
        dropCounter = 0;
    }

    handleInput(time); // Handle continuous input
    draw();
    requestAnimationFrame(update);
}


function updateScore() {
    scoreElement.innerText = player.score;
    // Level up every 300 points
    const level = Math.floor(player.score / 300) + 1;

    if (level > lastLevel) {
        levelUpEffect();
        lastLevel = level;
    }

    levelElement.innerText = level;
    // Speed increases slowly until level 30 (approx 30ms decrease per level)
    // Start: 1000ms, End (Lv 30): ~130ms (capped at 100)
    dropInterval = Math.max(100, 1000 - (level - 1) * 30);
}

function levelUpEffect() {
    playSound('levelUp');
    levelUpModal.classList.add('active');
    setTimeout(() => {
        levelUpModal.classList.remove('active');
    }, 2000);
}

function gameOver() {
    isGameOver = true;
    modal.classList.remove('hidden');
    finalScoreElement.innerText = player.score;
    playSound('gameOver');
    stopBGM();
}

function restartGame() {
    arena.forEach(row => row.fill(0));
    player.score = 0;
    player.hold = null;
    canHold = true;
    lastLevel = 1;
    updateScore();
    drawHoldPiece();

    isGameOver = false;
    modal.classList.add('hidden');
    highScoreForm.classList.remove('hidden');
    leaderboardDiv.classList.add('hidden');

    playerReset();
    lastTime = 0;

    // Resume audio context if needed
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // Restart BGM if it was stopped
    startBGM();

    requestAnimationFrame(update);
}

function togglePause() {
    if (!isGameStarted || isGameOver) return;

    isPaused = !isPaused;

    if (isPaused) {
        pauseScreen.classList.remove('hidden');
        if (audioCtx.state === 'running') audioCtx.suspend();
    } else {
        pauseScreen.classList.add('hidden');
        if (audioCtx.state === 'suspended') audioCtx.resume();
        lastTime = performance.now();
        requestAnimationFrame(update);
    }
}

function startGame() {
    startScreen.classList.add('hidden');
    isGameStarted = true;
    isPaused = false;
    isGameOver = false;

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    startBGM();

    playerReset();
    updateScore();

    lastTime = performance.now();
    update();
}

// Leaderboard Logic
function saveHighScore() {
    const name = playerNameInput.value.trim() || "Anonymous";
    const score = player.score;

    const highScores = JSON.parse(localStorage.getItem('brickDropScores')) || [];
    const newScore = { name, score, date: new Date().toLocaleDateString() };

    highScores.push(newScore);
    highScores.sort((a, b) => b.score - a.score);
    highScores.splice(10); // Keep top 10

    localStorage.setItem('brickDropScores', JSON.stringify(highScores));

    displayHighScores();
    highScoreForm.classList.add('hidden'); // Hide form after saving
}

function displayHighScores() {
    const highScores = JSON.parse(localStorage.getItem('brickDropScores')) || [];
    highScoresList.innerHTML = highScores
        .map((score, index) => `
            <li>
                <span><span class="score-rank">#${index + 1}</span> ${score.name}</span>
                <span>${score.score}</span>
            </li>
        `)
        .join('');
    leaderboardDiv.classList.remove('hidden');
}

saveScoreBtn.addEventListener('click', saveHighScore);

// Global Variables
const arena = createMatrix(12, 20);

const player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    score: 0,
    type: null,
    hold: null,
};

let canHold = true;
let nextPieces = [];

// Input handling with DAS (Delayed Auto Shift) & ARR (Auto Repeat Rate)
const keyState = {};
const keyTimers = {};

const DAS_DELAY = 150; // ms to wait before auto repeat
const ARR_DELAY = 50;  // ms between repeats

function handleInput(time) {
    // Left
    if (keyState[37]) {
        if (!keyTimers[37]) {
            playerMove(-1);
            keyTimers[37] = time + DAS_DELAY;
        } else if (time > keyTimers[37]) {
            playerMove(-1);
            keyTimers[37] = time + ARR_DELAY;
        }
    }

    // Right
    if (keyState[39]) {
        if (!keyTimers[39]) {
            playerMove(1);
            keyTimers[39] = time + DAS_DELAY;
        } else if (time > keyTimers[39]) {
            playerMove(1);
            keyTimers[39] = time + ARR_DELAY;
        }
    }

    // Down (Soft Drop)
    if (keyState[40]) {
        if (!keyTimers[40]) {
            playerDrop();
            keyTimers[40] = time + ARR_DELAY; // Faster drop
        } else if (time > keyTimers[40]) {
            playerDrop();
            keyTimers[40] = time + ARR_DELAY;
        }
    }
}

document.addEventListener('keydown', event => {
    // Start Game logic
    if (!isGameStarted) {
        if (event.keyCode === 13) { // Enter
            startGame();
        }
        return;
    }

    if (isGameOver) return;

    // Pause Logic
    if (event.keyCode === 80 || event.keyCode === 27) { // P or ESC
        togglePause();
        return;
    }

    if (isPaused) return;

    if (!keyState[event.keyCode]) {
        keyState[event.keyCode] = true;
        keyTimers[event.keyCode] = 0; // Immediate move on first press

        // Instant actions (Rotate, Hard Drop) don't need DAS/ARR
        if (event.keyCode === 81) {
            playerRotate(-1);
        } else if (event.keyCode === 87 || event.keyCode === 38) { // W or Up
            playerRotate(1);
        } else if (event.keyCode === 32) { // Space
            playerHardDrop();
            keyState[32] = false; // Prevent repeat hard drop
        } else if (event.keyCode === 16 || event.keyCode === 67) { // Shift or C for Hold
            playerHold();
        }
    }
});

document.addEventListener('keyup', event => {
    keyState[event.keyCode] = false;
    delete keyTimers[event.keyCode];
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);


// Mobile Controls
const mobileBtnState = {};
function startMobileRepeat(action, btnId) {
    if (isGameOver || !isGameStarted || isPaused) return;
    action();
    const interval = setInterval(action, 100);
    mobileBtnState[btnId] = interval;
}
function stopMobileRepeat(btnId) {
    clearInterval(mobileBtnState[btnId]);
    delete mobileBtnState[btnId];
}

const bindTouch = (id, action) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!isGameStarted) return;

        if (id === 'btn-drop' || id === 'btn-rotate' || id === 'btn-hold') {
            action();
        } else {
            startMobileRepeat(action, id);
        }
    });
    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        stopMobileRepeat(id);
    });
    btn.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        stopMobileRepeat(id);
    });
};

bindTouch('btn-left', () => { playerMove(-1); });
bindTouch('btn-right', () => { playerMove(1); });
bindTouch('btn-down', () => { playerDrop(); });
bindTouch('btn-rotate', () => { playerRotate(1); });
bindTouch('btn-drop', () => { playerHardDrop(); });
bindTouch('btn-hold', () => { playerHold(); });


// Initialize
// playerReset(); // Don't reset yet, wait for start
context.fillStyle = '#000';
context.fillRect(0, 0, canvas.width, canvas.height);
updateScore();
// update(); // Don't start update loop logic yet
