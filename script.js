// ============================================================
//  TUČNIAČIK NA ĽADE  —  script.js
// ============================================================

// ============================================================
//  FIREBASE CONFIG (online shared leaderboard)
//  Voliteľné — vyplň z Firebase Console > Project Settings
//  Pre nastavenie: https://firebase.google.com/
//  Pravidlá DB nastav na { ".read": true, ".write": true }
// ============================================================
const FIREBASE_CONFIG = null;
/* Príklad:
const FIREBASE_CONFIG = {
    apiKey:            "AIza...",
    authDomain:        "tvojprojekt.firebaseapp.com",
    databaseURL:       "https://tvojprojekt-default-rtdb.firebaseio.com",
    projectId:         "tvojprojekt",
    storageBucket:     "tvojprojekt.appspot.com",
    messagingSenderId: "123456789",
    appId:             "1:123:web:abc"
};
*/

let firebaseDB = null;

function initFirebase() {
    if (!FIREBASE_CONFIG || typeof firebase === 'undefined') return;
    try {
        if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        firebaseDB = firebase.database();
        console.log('🔥 Firebase online leaderboard aktívny!');
    } catch (e) {
        console.warn('Firebase nedostupný, používam lokálny leaderboard.', e);
    }
}
initFirebase();

// --- DOM REFERENCES ---
const screens = {
    menu:     document.getElementById('main-menu'),
    game:     document.getElementById('game-screen'),
    gameOver: document.getElementById('game-over-screen')
};
const penguinWrap    = document.getElementById('player-penguin');
const gameArea       = document.getElementById('game-area');
const hudElement     = document.getElementById('hud');
const scoreEl        = document.getElementById('score');
const levelEl        = document.getElementById('level');
const livesHeartsEl  = document.getElementById('lives-hearts');
const statCaughtEl   = document.getElementById('stat-caught');
const statMissedEl   = document.getElementById('stat-missed');
const statTimeEl     = document.getElementById('stat-time');
const finalScoreEl   = document.getElementById('final-score');
const levelUpOverlay = document.getElementById('level-up-overlay');
const leaderboardEl  = document.getElementById('leaderboard-list');
const gameOverTitle  = document.getElementById('game-over-title');
const pauseBtn       = document.getElementById('pause-btn');
const zombieBtn      = document.getElementById('zombie-btn');
const shootBtn       = document.getElementById('shoot-btn');
const weaponBarFill  = document.getElementById('weapon-bar-fill');
const nameInput      = document.getElementById('player-name-input');

// ============================================================
//  PLAYER NAME  —  persists in localStorage
// ============================================================
const NAME_KEY = 'tucniak_player_name';

function getPlayerName() {
    return localStorage.getItem(NAME_KEY) || '';
}
function savePlayerName(name) {
    localStorage.setItem(NAME_KEY, name.trim());
}

// Pre-fill name input from localStorage
nameInput.value = getPlayerName();
// Save on every keystroke
nameInput.addEventListener('input', () => savePlayerName(nameInput.value));
// Prevent game area hover-pause while typing
nameInput.addEventListener('focus', () => { gameState.isHoverPaused = false; });

// ============================================================
//  WEB AUDIO ENGINE
// ============================================================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudio() {
    if (!audioCtx) audioCtx = new AudioCtx();
    return audioCtx;
}

function playTone(freq, type, duration, vol = 0.3, startFreq = null) {
    try {
        const ctx  = getAudio();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(startFreq || freq, ctx.currentTime);
        if (startFreq) osc.frequency.exponentialRampToValueAtTime(freq, ctx.currentTime + duration);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.start(); osc.stop(ctx.currentTime + duration);
    } catch (e) {}
}

function playNoise(duration, vol = 0.15) {
    try {
        const ctx    = getAudio();
        const bufLen = ctx.sampleRate * duration;
        const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data   = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
        const src  = ctx.createBufferSource();
        const gain = ctx.createGain();
        src.buffer = buf;
        src.connect(gain); gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        src.start(); src.stop(ctx.currentTime + duration);
    } catch (e) {}
}

const SFX = {
    fish:    () => { playTone(880, 'sine', 0.12, 0.22); playTone(1200, 'sine', 0.09, 0.14); },
    rare:    () => { [440, 660, 880].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.13, 0.25), i * 55)); },
    epic:    () => { [440, 550, 660, 880, 1100].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.14, 0.28), i * 50)); },
    hit:     () => { playNoise(0.18, 0.22); playTone(120, 'sawtooth', 0.14, 0.2); },
    bigHit:  () => { playNoise(0.3, 0.38); playTone(80, 'sawtooth', 0.22, 0.3); },
    levelUp: () => { [261, 329, 392, 523, 659].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.2, 0.22), i * 90)); },
    // Romantic kiss — ascending melody + double smooch pop
    kiss: () => {
        [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.35, 0.2), i * 120));
        setTimeout(() => { playNoise(0.07, 0.18); playTone(900, 'sine', 0.06, 0.12, 1400); }, 500);
        setTimeout(() => { playNoise(0.07, 0.18); playTone(900, 'sine', 0.06, 0.12, 1400); }, 800);
        setTimeout(() => { playTone(1047, 'sine', 0.5, 0.25); playTone(1319, 'sine', 0.4, 0.2); }, 1100);
    },
    shoot:     () => { playNoise(0.06, 0.28); playTone(300, 'sawtooth', 0.06, 0.14, 600); },
    zombieHit: () => { playTone(180, 'sawtooth', 0.2, 0.28, 380); playNoise(0.1, 0.18); },
    brain:     () => { playTone(440, 'triangle', 0.1, 0.18); playTone(330, 'sine', 0.1, 0.14); },
};

// ============================================================
//  GAME STATE
// ============================================================
let gameState = {
    isRunning: false, isManualPaused: false, isHoverPaused: false,
    isLevelingUp: false,   // ← FIX: game waits during level-up
    zombieMode: false,
    score: 0, lives: 5, level: 1,
    mouseX: window.innerWidth / 2, mouseY: window.innerHeight / 2,
    penguinX: window.innerWidth / 2, penguinY: window.innerHeight / 2,
    fishes: [], snowballs: [], bluePenguins: [], bullets: [],
    lastTime: 0, startTime: 0, timeScale: 1,
    stats: { caught: 0, missed: 0 },
    kissing: false,
    weaponCooldown: 0, weaponMaxCooldown: 60,
};

// ============================================================
//  DEVICE & CONTROLS
// ============================================================
const isMobile = () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

window.addEventListener('mousemove', e => {
    if (!isMobile()) { gameState.mouseX = e.clientX; gameState.mouseY = e.clientY; }
});
document.addEventListener('touchmove',  e => { if (!e.target.closest('input')) e.preventDefault(); }, { passive: false });
document.addEventListener('touchstart', e => { if (!e.target.closest('button') && !e.target.closest('input')) e.preventDefault(); }, { passive: false });

// --- JOYSTICK ---
const joystickZone = document.getElementById('joystick-zone');
const joystickBase = document.getElementById('joystick-base');
const joystickKnob = document.getElementById('joystick-knob');
let joystick = { active: false, startX: 0, startY: 0, dx: 0, dy: 0, maxRadius: 40 };

function initJoystick() {
    const r = joystickBase.getBoundingClientRect().width / 2;
    joystick.maxRadius = r * 0.55;
}

joystickZone.addEventListener('touchstart', e => {
    if (!gameState.isRunning) return;
    e.stopPropagation();
    const rect = joystickBase.getBoundingClientRect();
    joystick.active = true;
    joystick.startX = rect.left + rect.width / 2;
    joystick.startY = rect.top + rect.height / 2;
}, { passive: true });

joystickZone.addEventListener('touchmove', e => {
    if (!joystick.active || !gameState.isRunning) return;
    e.stopPropagation();
    const touch = e.touches[0];
    let dx = touch.clientX - joystick.startX;
    let dy = touch.clientY - joystick.startY;
    const dist   = Math.sqrt(dx * dx + dy * dy);
    const capped = Math.min(dist, joystick.maxRadius);
    if (dist > 0) { dx = (dx / dist) * capped; dy = (dy / dist) * capped; }
    joystick.dx = dx; joystick.dy = dy;
    joystickKnob.style.transform = `translate(${dx}px,${dy}px)`;
    gameState.mouseX = gameState.penguinX + dx * 3.5;
    gameState.mouseY = gameState.penguinY + dy * 3.5;
}, { passive: true });

function resetJoystick() {
    joystick.active = false; joystick.dx = 0; joystick.dy = 0;
    joystickKnob.style.transform = 'translate(0,0)';
    gameState.mouseX = gameState.penguinX;
    gameState.mouseY = gameState.penguinY;
}
joystickZone.addEventListener('touchend',    resetJoystick, { passive: true });
joystickZone.addEventListener('touchcancel', resetJoystick, { passive: true });

gameArea.addEventListener('touchstart', e => {
    if (!gameState.isRunning || e.target.closest('#joystick-zone') || e.target.closest('#hud') || e.target.closest('#shoot-btn')) return;
    const t = e.touches[0];
    gameState.mouseX = t.clientX; gameState.mouseY = t.clientY;
}, { passive: true });
gameArea.addEventListener('touchmove', e => {
    if (!gameState.isRunning || joystick.active || e.target.closest('#joystick-zone')) return;
    const t = e.touches[0];
    gameState.mouseX = t.clientX; gameState.mouseY = t.clientY;
}, { passive: true });

// ============================================================
//  HUD
// ============================================================
function switchScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

function updateHUD() {
    scoreEl.innerText = gameState.score;
    levelEl.innerText = gameState.level;
    const lives = Math.max(0, Math.min(gameState.lives, 5));
    livesHeartsEl.innerText = '❤️'.repeat(lives) + '🖤'.repeat(Math.max(0, 5 - lives));
}

function isGamePaused() {
    return gameState.isManualPaused || gameState.isHoverPaused || gameState.isLevelingUp;
}

hudElement.addEventListener('mouseenter', () => { if (gameState.isRunning && !isMobile()) gameState.isHoverPaused = true; });
hudElement.addEventListener('mouseleave', () => { if (gameState.isRunning) gameState.isHoverPaused = false; });

// ============================================================
//  BUTTONS
// ============================================================
pauseBtn.addEventListener('click', () => {
    if (!gameState.isRunning) return;
    gameState.isManualPaused = !gameState.isManualPaused;
    pauseBtn.innerText = gameState.isManualPaused ? '▶' : '⏸';
    pauseBtn.classList.toggle('paused', gameState.isManualPaused);
});

zombieBtn.addEventListener('click', () => {
    gameState.zombieMode = !gameState.zombieMode;
    const on = gameState.zombieMode;
    zombieBtn.classList.toggle('zombie-on', on);
    document.body.classList.toggle('zombie-theme', on);
    gameArea.classList.toggle('zombie-mode-active', on);
    gameOverTitle.innerText = on ? 'Zomrel si... 🧟' : 'Hra skončila!';
});

// ============================================================
//  WEAPON
// ============================================================
function fireShotgun() {
    if (!gameState.isRunning || !gameState.zombieMode || gameState.weaponCooldown > 0 || isGamePaused()) return;
    SFX.shoot();
    gameState.weaponCooldown = gameState.weaponMaxCooldown;
    const angle = Math.atan2(gameState.mouseY - gameState.penguinY, gameState.mouseX - gameState.penguinX);
    [-0.28, 0, 0.28].forEach(spread => {
        const a = angle + spread;
        const bullet = document.createElement('div');
        bullet.className = 'bullet';
        bullet.style.left = `${gameState.penguinX}px`;
        bullet.style.top  = `${gameState.penguinY}px`;
        bullet.style.transform = `translate(-50%,-50%) rotate(${a}rad)`;
        gameArea.appendChild(bullet);
        gameState.bullets.push({ el: bullet, x: gameState.penguinX, y: gameState.penguinY, vx: Math.cos(a) * 13, vy: Math.sin(a) * 13, life: 55 });
    });
}

shootBtn.addEventListener('click', fireShotgun);
shootBtn.addEventListener('touchstart', e => { e.stopPropagation(); fireShotgun(); }, { passive: true });
gameArea.addEventListener('click', () => { if (gameState.zombieMode) fireShotgun(); });

// ============================================================
//  LEADERBOARD  (Firebase online, fallback to localStorage)
// ============================================================
const LB_KEY = 'tucniak_scores';

function getLocalScores() {
    try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; } catch { return []; }
}
function saveLocalScores(arr) {
    localStorage.setItem(LB_KEY, JSON.stringify(arr));
}

function submitScore(name, score, mode) {
    const entry = {
        name: name || 'Anonym',
        score,
        mode: mode ? '🧟' : '🐟',
        date: new Date().toLocaleDateString('sk-SK')
    };

    // Always save locally too
    const local = getLocalScores();
    local.push(entry);
    local.sort((a, b) => b.score - a.score);
    local.splice(10);
    saveLocalScores(local);

    // Push to Firebase if available
    if (firebaseDB) {
        firebaseDB.ref('scores').push({
            ...entry,
            timestamp: Date.now()
        }).catch(err => console.warn('Firebase write error:', err));
    }
}

function renderLeaderboard(currentScore) {
    const medals = ['🥇', '🥈', '🥉', '4.', '5.'];

    function render(entries) {
        leaderboardEl.innerHTML = '';
        entries.slice(0, 5).forEach((e, i) => {
            const li = document.createElement('li');
            const isNew = e.score === currentScore && i === 0;
            const modeTag = e.mode || '';
            li.innerHTML = `${medals[i] || (i + 1 + '.')} <strong>${e.name}</strong> — ${e.score} b ${modeTag} <small>${e.date || ''}</small>`;
            if (isNew) li.classList.add('new-record');
            leaderboardEl.appendChild(li);
        });
    }

    if (firebaseDB) {
        // Load online scores — sorted descending
        firebaseDB.ref('scores')
            .orderByChild('score')
            .limitToLast(50)
            .once('value', snap => {
                const all = [];
                snap.forEach(c => all.push(c.val()));
                all.sort((a, b) => b.score - a.score);
                render(all.slice(0, 5));
            })
            .catch(() => render(getLocalScores())); // fallback
    } else {
        render(getLocalScores());
    }
}

// ============================================================
//  ENVIRONMENT — Water Ripples
// ============================================================
function spawnRipple() {
    const r = document.createElement('div');
    r.className = 'water-ripple';
    r.style.left = `${10 + Math.random() * 80}vw`;
    r.style.top  = `${15 + Math.random() * 70}vh`;
    document.getElementById('bg-layer').appendChild(r);
    setTimeout(() => r.remove(), 3000);
}
setInterval(spawnRipple, 1800);

// ============================================================
//  SVG GENERATORS
// ============================================================
function getFishSVG(colorBody, colorTail) {
    return `<svg viewBox="0 0 100 100" class="svg-fish">
        <path d="M 30,50 L 5,20 L 15,50 L 5,80 Z" fill="${colorTail}"/>
        <ellipse cx="60" cy="50" rx="40" ry="25" fill="${colorBody}"/>
        <circle cx="80" cy="40" r="5" fill="#fff"/>
        <circle cx="82" cy="40" r="2" fill="#000"/>
        <path d="M 50,25 C 60,10 70,10 75,25 Z" fill="${colorTail}"/>
        <path d="M 50,75 C 60,90 70,90 75,75 Z" fill="${colorTail}"/>
    </svg>`;
}

function getBrainSVG() {
    return `<svg viewBox="0 0 100 120" class="svg-fish" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,.4));">
        <path d="M20,60 C10,40 30,10 50,30 C70,10 90,40 80,60 C90,80 70,100 50,80 C30,100 10,80 20,60 Z" fill="#F06292"/>
        <path d="M50,15 L50,88" stroke="#C2185B" stroke-width="4.5" fill="none" stroke-linecap="round"/>
        <path d="M25,40 Q40,28 50,44 Q25,58 25,40" stroke="#C2185B" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M75,40 Q60,28 50,44 Q75,58 75,40" stroke="#C2185B" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M28,68 Q44,80 50,64 Q28,60 28,68" stroke="#C2185B" stroke-width="2.5" fill="none"/>
        <path d="M72,68 Q56,80 50,64 Q72,60 72,68" stroke="#C2185B" stroke-width="2.5" fill="none"/>
        <path d="M 50,80 Q 48,105 50,112 Q 52,105 50,80" fill="#B71C1C"/>
        <circle cx="50" cy="115" r="4" fill="#B71C1C"/>
        <path d="M 28,68 Q 26,90 28,96 Q 30,90 28,68" fill="#B71C1C"/>
        <circle cx="28" cy="100" r="3" fill="#B71C1C"/>
        <path d="M 75,58 Q 73,80 75,86 Q 77,80 75,58" fill="#B71C1C"/>
        <circle cx="42" cy="88" r="5" fill="#B71C1C" opacity="0.85"/>
        <circle cx="66" cy="83" r="4" fill="#B71C1C" opacity="0.8"/>
        <circle cx="55" cy="95" r="3" fill="#B71C1C" opacity="0.9"/>
    </svg>`;
}

function getZombieSVG(isElite = false) {
    const skinC = isElite ? '#6A1B9A' : '#2E7D32';
    const bodyC = isElite ? '#4A148C' : '#1B5E20';
    const eyeC  = isElite ? '#CE93D8' : '#EF9A9A';
    const glowC = isElite ? '#E040FB' : '#ff4d4d';
    return `<svg viewBox="0 0 80 100" class="svg-fish">
        <!-- Hunched body (smaller, more menacing silhouette) -->
        <path d="M 10,100 C 12,65 68,65 70,100 Z" fill="${bodyC}"/>
        <!-- Torn dark cloak -->
        <path d="M 8,100 C 20,50 60,50 72,100 Z" fill="#1a1a2e" opacity="0.85"/>
        <path d="M 16,100 L 20,80 L 28,100" fill="#0d0d1a"/>
        <path d="M 55,100 L 60,82 L 67,100" fill="#0d0d1a"/>
        <!-- Belt of skulls -->
        <path d="M 15,68 Q 40,58 65,68" stroke="#37474F" stroke-width="5" fill="none"/>
        <circle cx="30" cy="64" r="4" fill="#CFD8DC"/>
        <circle cx="40" cy="61" r="4" fill="#CFD8DC"/>
        <circle cx="50" cy="63" r="4" fill="#CFD8DC"/>
        <!-- Head (tilted menacingly) -->
        <ellipse cx="40" cy="38" rx="23" ry="28" fill="${skinC}" transform="rotate(-4 40 38)"/>
        <!-- Exposed brain on top -->
        <path d="M 45,12 C 54,7 63,18 55,23 C 46,18 41,14 45,12 Z" fill="#F06292"/>
        <path d="M 45,12 C 54,7 63,18 55,23" stroke="#B71C1C" stroke-width="2" fill="none"/>
        <!-- Gaping jagged mouth -->
        <path d="M 28,58 C 32,72 48,72 52,58 Z" fill="#0a0a0a"/>
        <path d="M 30,58 L 33,66 L 37,58 M 43,58 L 46,67 L 50,58" stroke="ivory" stroke-width="2.5" fill="none" stroke-linejoin="miter"/>
        <!-- Dripping from mouth -->
        <path d="M 40,72 Q 38,84 40,90 Q 42,84 40,72" fill="#33691E" opacity="0.8"/>
        <!-- Hollow terrifying eyes -->
        <circle cx="30" cy="33" r="9" fill="#000"/>
        <circle cx="50" cy="33" r="9" fill="#000"/>
        <circle cx="30" cy="33" r="5" fill="${eyeC}" opacity="0.85"/>
        <circle cx="50" cy="33" r="5" fill="${eyeC}" opacity="0.85"/>
        <circle cx="30" cy="33" r="2" fill="${glowC}"/>
        <circle cx="50" cy="33" r="2" fill="${glowC}"/>
        ${isElite ? '<path d="M 28,22 L 40,14 L 52,22" stroke="#CE93D8" stroke-width="2.5" fill="none"/>' : ''}
        <!-- Stitches on face -->
        <path d="M 24,24 L 34,30 M 26,18 L 30,36" stroke="#B71C1C" stroke-width="2.5"/>
        <!-- Outstretched rotting arms -->
        <path d="M 8,72 Q -8,52 8,40" stroke="${skinC}" stroke-width="10" stroke-linecap="round" fill="none"/>
        <path d="M 72,72 Q 88,52 72,40" stroke="${skinC}" stroke-width="10" stroke-linecap="round" fill="none"/>
        <!-- Clawed finger tips -->
        <path d="M 8,40 L 2,34 M 8,40 L 4,30" stroke="${skinC}" stroke-width="3" stroke-linecap="round"/>
        <path d="M 72,40 L 78,34 M 72,40 L 76,30" stroke="${skinC}" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
}

// Blue penguin SVG with zombie-mode gear
const pSVG = `<svg viewBox="0 0 100 100" class="svg-penguin" style="--skin-color:#03A9F4;">
<ellipse cx="30" cy="90" rx="15" ry="8" fill="#FF9800"/>
<ellipse cx="70" cy="90" rx="15" ry="8" fill="#FF9800"/>
<ellipse cx="50" cy="55" rx="40" ry="45" fill="var(--skin-color)"/>
<ellipse cx="50" cy="65" rx="30" ry="30" fill="#FFF"/>
<g class="zombie-gear">
    <path d="M 12,33 L 60,47" stroke="#111" stroke-width="2.5"/>
    <circle cx="35" cy="40" r="9" fill="#222"/>
    <path d="M 17,55 Q 50,75 83,60" fill="none" stroke="#5D4037" stroke-width="8"/>
    <rect x="25" y="58" width="4" height="12" fill="#FFC107" transform="rotate(-15 27 64)"/>
    <rect x="40" y="62" width="4" height="12" fill="#FFC107" transform="rotate(-5 42 68)"/>
    <rect x="55" y="62" width="4" height="12" fill="#FFC107" transform="rotate(5 57 68)"/>
    <rect x="70" y="58" width="4" height="12" fill="#FFC107" transform="rotate(15 72 64)"/>
    <g transform="translate(65,45) rotate(-45)">
        <rect x="-15" y="-3" width="18" height="8" fill="#4E342E" rx="2"/>
        <rect x="3" y="-3" width="35" height="4" fill="#546E7A"/>
        <rect x="3" y="2" width="35" height="4" fill="#546E7A"/>
    </g>
</g>
<ellipse cx="10" cy="60" rx="10" ry="25" fill="var(--skin-color)" transform="rotate(20 10 60)"/>
<ellipse cx="90" cy="60" rx="10" ry="25" fill="var(--skin-color)" transform="rotate(-20 90 60)"/>
<circle cx="35" cy="40" r="5" fill="#000"/>
<circle cx="65" cy="40" r="5" fill="#000"/>
<circle cx="37" cy="38" r="2" fill="#fff"/>
<circle cx="67" cy="38" r="2" fill="#fff"/>
<path d="M 45,46 L 55,46 L 50,52 Z" fill="#FF9800"/>
</svg>`;

// ============================================================
//  GAME CONTROL
// ============================================================
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

function startGame() {
    // Unlock audio on first interaction
    try { if (!audioCtx) audioCtx = new AudioCtx(); audioCtx.resume(); } catch(e) {}

    const name = nameInput.value.trim() || 'Anonym';
    savePlayerName(name);

    gameState.score  = 0; gameState.lives = 5; gameState.level = 1;
    gameState.stats.caught = 0; gameState.stats.missed = 0;
    gameState.startTime = Date.now();
    gameState.isRunning  = true;
    gameState.isManualPaused = false; gameState.isHoverPaused = false;
    gameState.isLevelingUp   = false;
    gameState.timeScale = 1; gameState.kissing = false;
    gameState.weaponCooldown = 0;

    pauseBtn.innerText = '⏸';
    pauseBtn.classList.remove('paused');
    penguinWrap.classList.remove('kissing-animation', 'kissing-rotate-left');

    document.querySelectorAll('.fish,.snowball,.explosion,.zombie-explosion,.blue-penguin-wrap,.kiss-heart,.bullet')
        .forEach(el => el.remove());

    gameState.fishes = []; gameState.snowballs = [];
    gameState.bluePenguins = []; gameState.bullets = [];

    updateHUD();
    switchScreen('game');
    spawnFish();
    setTimeout(initJoystick, 100);
    requestAnimationFrame(gameLoop);
}

function endGame() {
    gameState.isRunning = false;
    const timeSpent = Math.floor((Date.now() - gameState.startTime) / 1000);
    statCaughtEl.innerText = gameState.stats.caught;
    statMissedEl.innerText = gameState.stats.missed;
    statTimeEl.innerText   = timeSpent;
    finalScoreEl.innerText = gameState.score;
    const name = nameInput.value.trim() || 'Anonym';
    submitScore(name, gameState.score, gameState.zombieMode);
    renderLeaderboard(gameState.score);
    switchScreen('gameOver');
}

// ============================================================
//  EFFECTS
// ============================================================
function createExplosion(x, y, zombie = false) {
    const el = document.createElement('div');
    el.className = zombie ? 'zombie-explosion' : 'explosion';
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    gameArea.appendChild(el);
    setTimeout(() => el.remove(), 500);
}

function spawnKissHeart(x, y) {
    const h = document.createElement('div');
    h.className = 'kiss-heart'; h.innerText = '💙';
    h.style.left = `${x}px`; h.style.top = `${y}px`;
    gameArea.appendChild(h);
    setTimeout(() => h.remove(), 2000);
}

// ============================================================
//  SPAWNERS
// ============================================================
function spawnFish() {
    if (!gameState.isRunning) return;
    const div = document.createElement('div');
    div.className = 'fish';
    let points = 1, colorBody = '#FFC107', colorTail = '#FFA000';

    if (gameState.level >= 2 && Math.random() < 0.2) {
        div.classList.add('rare'); points = 2;
        colorBody = '#29B6F6'; colorTail = '#0288D1';
    } else if (gameState.level >= 3 && Math.random() < 0.1) {
        div.classList.add('epic'); points = 3;
        colorBody = '#AB47BC'; colorTail = '#7B1FA2';
    }

    div.innerHTML = gameState.zombieMode ? getBrainSVG() : getFishSVG(colorBody, colorTail);

    const pad = 90;
    const x = pad + Math.random() * (window.innerWidth  - pad * 2);
    const y = pad + Math.random() * (window.innerHeight - pad * 2);
    div.style.left = `${x}px`; div.style.top = `${y}px`;
    gameArea.appendChild(div);
    gameState.fishes.push({ el: div, x, y, points, lifetime: 500 + Math.random() * 200 });
}

function spawnBluePenguin() {
    if (!gameState.isRunning) return;
    const div = document.createElement('div');
    div.className = 'blue-penguin-wrap';
    div.innerHTML = pSVG;
    const x = Math.random() < 0.5 ? 50 : window.innerWidth  - 50;
    const y = Math.random() < 0.5 ? 50 : window.innerHeight - 50;
    div.style.left = `${x}px`; div.style.top = `${y}px`;
    gameArea.appendChild(div);
    const angle = Math.atan2(window.innerHeight / 2 - y, window.innerWidth / 2 - x);
    gameState.bluePenguins.push({ el: div, x, y, vx: Math.cos(angle) * 1.5, vy: Math.sin(angle) * 1.5 });
}

function spawnSnowball() {
    if (!gameState.isRunning) return;
    const div = document.createElement('div');
    div.className = 'snowball';
    let isElite = false, damage = 1;

    if (gameState.level >= 2 && Math.random() < 0.3) {
        isElite = true; damage = 3;
        if (!gameState.zombieMode) div.classList.add('red');
    }

    if (gameState.zombieMode) {
        div.classList.add('zombie-item');
        div.innerHTML = getZombieSVG(isElite);
    }

    const size = 70;
    let x, y, vx, vy;
    const base = 2 + gameState.level * 0.5;
    const m    = isElite ? 1.6 : 1;

    if (Math.random() < 0.5) {
        x = Math.random() * window.innerWidth;
        y = Math.random() < 0.5 ? -size : window.innerHeight + size;
        vx = (Math.random() - 0.5) * 4 * m;
        vy = (y < 0 ? 1 : -1) * (base + Math.random() * 2) * m;
    } else {
        x = Math.random() < 0.5 ? -size : window.innerWidth + size;
        y = Math.random() * window.innerHeight;
        vx = (x < 0 ? 1 : -1) * (base + Math.random() * 2) * m;
        vy = (Math.random() - 0.5) * 4 * m;
    }
    gameArea.appendChild(div);
    gameState.snowballs.push({ el: div, x: x + size / 2, y: y + size / 2, vx, vy, damage, isElite });
}

// ============================================================
//  COLLISIONS
// ============================================================
function checkCollisions() {
    if (gameState.kissing) return;
    const penR = 28;

    // Fish / Brains
    for (let i = gameState.fishes.length - 1; i >= 0; i--) {
        const f  = gameState.fishes[i];
        const dx = gameState.penguinX - f.x, dy = gameState.penguinY - f.y;
        if (Math.sqrt(dx * dx + dy * dy) < penR + 22) {
            f.el.remove(); gameState.fishes.splice(i, 1);
            gameState.score += f.points; gameState.stats.caught++;
            if (f.points === 3) SFX.epic();
            else if (f.points === 2) SFX.rare();
            else gameState.zombieMode ? SFX.brain() : SFX.fish();
            if (gameState.score >= gameState.level * 6) levelUp(); else spawnFish();
            updateHUD();
        }
    }

    // Snowballs / Zombie enemies
    for (let i = gameState.snowballs.length - 1; i >= 0; i--) {
        const sb = gameState.snowballs[i];
        const dx = gameState.penguinX - sb.x, dy = gameState.penguinY - sb.y;
        if (Math.sqrt(dx * dx + dy * dy) < penR + 24) {
            createExplosion(sb.x, sb.y, gameState.zombieMode);
            sb.damage === 3 ? SFX.bigHit() : SFX.hit();
            gameState.lives -= sb.damage;
            sb.el.remove(); gameState.snowballs.splice(i, 1);
            updateHUD();
            if (gameState.lives <= 0) {
                gameState.lives = 0; updateHUD();
                setTimeout(() => endGame(), 350); return;
            }
        }
    }

    // Bullets vs Zombie enemies
    if (gameState.zombieMode) {
        for (let bi = gameState.bullets.length - 1; bi >= 0; bi--) {
            const b = gameState.bullets[bi];
            let hit = false;
            for (let si = gameState.snowballs.length - 1; si >= 0; si--) {
                const sb = gameState.snowballs[si];
                const dx = b.x - sb.x, dy = b.y - sb.y;
                if (Math.sqrt(dx * dx + dy * dy) < 32) {
                    SFX.zombieHit();
                    createExplosion(sb.x, sb.y, true);
                    gameState.score += sb.isElite ? 2 : 1;
                    sb.el.remove(); gameState.snowballs.splice(si, 1);
                    updateHUD(); hit = true; break;
                }
            }
            if (hit) { b.el.remove(); gameState.bullets.splice(bi, 1); }
        }
    }

    // Blue penguin → KISS! 💙
    for (let i = gameState.bluePenguins.length - 1; i >= 0; i--) {
        const bp = gameState.bluePenguins[i];
        const dx = gameState.penguinX - bp.x, dy = gameState.penguinY - bp.y;
        if (Math.sqrt(dx * dx + dy * dy) < penR + 30) {
            gameState.kissing = true;
            gameState.timeScale = 0.03;   // ← deeper slow-mo
            SFX.kiss();
            const cx = window.innerWidth / 2, cy = window.innerHeight / 2;

            penguinWrap.classList.add('kissing-animation', 'kissing-rotate-left');
            penguinWrap.style.left = `${cx - 55}px`;
            penguinWrap.style.top  = `${cy}px`;

            bp.el.classList.add('kissing-animation', 'kissing-rotate-right');
            bp.el.style.left = `${cx + 55}px`;
            bp.el.style.top  = `${cy}px`;

            // Spawn several hearts over time
            setTimeout(() => spawnKissHeart(cx,      cy - 90), 700);
            setTimeout(() => spawnKissHeart(cx - 30, cy - 120), 1300);
            setTimeout(() => spawnKissHeart(cx + 30, cy - 100), 1800);

            gameState.lives += 3; updateHUD();

            setTimeout(() => {
                bp.el.remove(); gameState.bluePenguins.splice(i, 1);
                gameState.kissing = false;
                penguinWrap.classList.remove('kissing-animation', 'kissing-rotate-left');
                gameState.timeScale = 1;
            }, 3800);   // ← 3.8s instead of 2.5s
        }
    }
}

// ============================================================
//  LEVEL UP  —  game fully pauses during overlay
// ============================================================
function levelUp() {
    gameState.level++;
    gameState.isLevelingUp = true;   // ← PAUSE GAME
    SFX.levelUp();
    levelUpOverlay.querySelector('h2').innerText = `⭐ Level ${gameState.level}! ⭐`;
    levelUpOverlay.classList.remove('hidden');

    setTimeout(() => {
        levelUpOverlay.classList.add('hidden');
        gameState.isLevelingUp = false;  // ← RESUME GAME
        spawnFish();
        if (gameState.level > 1) spawnSnowball();
    }, 2000);
}

// ============================================================
//  GAME LOOP
// ============================================================
function gameLoop(timestamp) {
    if (!gameState.isRunning) return;
    gameState.lastTime = timestamp;

    if (isGamePaused()) { requestAnimationFrame(gameLoop); return; }

    const ts = gameState.timeScale;

    // --- Penguin movement ---
    if (!gameState.kissing) {
        const speed = 0.1 * ts;
        gameState.penguinX += (gameState.mouseX - gameState.penguinX) * speed;
        gameState.penguinY += (gameState.mouseY - gameState.penguinY) * speed;
        const vx   = (gameState.mouseX - gameState.penguinX) * speed;
        const tilt = vx > 0.4 ? 18 : (vx < -0.4 ? -18 : 0);
        penguinWrap.style.transform = `translate(-50%,-50%) rotate(${tilt}deg)`;
        penguinWrap.style.left = `${gameState.penguinX}px`;
        penguinWrap.style.top  = `${gameState.penguinY}px`;
    }

    // --- Fish lifetime ---
    for (let i = gameState.fishes.length - 1; i >= 0; i--) {
        const f = gameState.fishes[i];
        f.lifetime -= 1 * ts;
        if (f.lifetime < 100) f.el.classList.add('fading');
        if (f.lifetime <= 0) {
            f.el.remove(); gameState.fishes.splice(i, 1);
            gameState.stats.missed++;
            spawnFish();
        }
    }

    // --- Snowballs / Zombies ---
    for (let i = gameState.snowballs.length - 1; i >= 0; i--) {
        const sb = gameState.snowballs[i];
        sb.x += sb.vx * ts; sb.y += sb.vy * ts;
        sb.el.style.left = `${sb.x - 35}px`;
        sb.el.style.top  = `${sb.y - 35}px`;
        if (sb.x < -280 || sb.x > window.innerWidth + 280 || sb.y < -280 || sb.y > window.innerHeight + 280) {
            sb.el.remove(); gameState.snowballs.splice(i, 1);
        }
    }

    // --- Bullets ---
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        const b = gameState.bullets[i];
        b.x += b.vx; b.y += b.vy; b.life--;
        b.el.style.left = `${b.x}px`; b.el.style.top = `${b.y}px`;
        if (b.life <= 0 || b.x < -50 || b.x > window.innerWidth + 50 || b.y < -50 || b.y > window.innerHeight + 50) {
            b.el.remove(); gameState.bullets.splice(i, 1);
        }
    }

    // --- Blue penguins ---
    for (let i = gameState.bluePenguins.length - 1; i >= 0; i--) {
        if (gameState.kissing) break;
        const bp = gameState.bluePenguins[i];
        bp.x += bp.vx * ts; bp.y += bp.vy * ts;
        bp.el.style.left = `${bp.x - 40}px`; bp.el.style.top = `${bp.y - 40}px`;
    }

    // --- Weapon cooldown bar ---
    if (gameState.weaponCooldown > 0) {
        gameState.weaponCooldown -= ts;
        if (weaponBarFill) {
            const pct = Math.max(0, 1 - gameState.weaponCooldown / gameState.weaponMaxCooldown);
            weaponBarFill.style.transform = `scaleX(${pct})`;
        }
    }

    // --- Spawn logic ---
    const spawnChance = (0.005 + gameState.level * 0.002) * ts;
    const maxSB = gameState.level + 1;
    if (gameState.level > 1 && Math.random() < spawnChance && gameState.snowballs.length < maxSB) spawnSnowball();
    if (Math.random() < 0.001 * ts && gameState.bluePenguins.length === 0 && !gameState.kissing) spawnBluePenguin();

    checkCollisions();
    requestAnimationFrame(gameLoop);
}
