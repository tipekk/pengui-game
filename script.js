// ============================================================
//  TUČNIAČIK NA ĽADE  —  script.js
// ============================================================

// --- DOM REFERENCES ---
const screens = {
    menu:     document.getElementById('main-menu'),
    game:     document.getElementById('game-screen'),
    gameOver: document.getElementById('game-over-screen')
};
const penguinWrap   = document.getElementById('player-penguin');
const gameArea      = document.getElementById('game-area');
const hudElement    = document.getElementById('hud');
const scoreEl       = document.getElementById('score');
const levelEl       = document.getElementById('level');
const livesHeartsEl = document.getElementById('lives-hearts');
const statCaughtEl  = document.getElementById('stat-caught');
const statMissedEl  = document.getElementById('stat-missed');
const statTimeEl    = document.getElementById('stat-time');
const finalScoreEl  = document.getElementById('final-score');
const levelUpOverlay= document.getElementById('level-up-overlay');
const leaderboardList = document.getElementById('leaderboard-list');
const gameOverTitle = document.getElementById('game-over-title');
const pauseBtn      = document.getElementById('pause-btn');
const zombieBtn     = document.getElementById('zombie-btn');
const shootBtn      = document.getElementById('shoot-btn');
const weaponBarFill = document.getElementById('weapon-bar-fill');

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
        const ctx = getAudio();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(startFreq || freq, ctx.currentTime);
        if (startFreq) osc.frequency.exponentialRampToValueAtTime(freq, ctx.currentTime + duration);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.start(); osc.stop(ctx.currentTime + duration);
    } catch(e) {}
}

function playNoise(duration, vol = 0.15) {
    try {
        const ctx    = getAudio();
        const bufLen = ctx.sampleRate * duration;
        const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data   = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);
        const src  = ctx.createBufferSource();
        const gain = ctx.createGain();
        src.buffer  = buf;
        src.connect(gain); gain.connect(ctx.destination);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        src.start(); src.stop(ctx.currentTime + duration);
    } catch(e) {}
}

const SFX = {
    fish:    () => { playTone(880, 'sine', 0.12, 0.25); playTone(1200, 'sine', 0.09, 0.15); },
    rare:    () => { playTone(660, 'sine', 0.15, 0.25); playTone(990, 'sine', 0.12, 0.2); playTone(1320,'sine',0.1,0.15); },
    epic:    () => { [440,550,660,880].forEach((f,i) => setTimeout(() => playTone(f,'triangle',0.12,0.3), i*50)); },
    hit:     () => { playNoise(0.18, 0.25); playTone(120, 'sawtooth', 0.15, 0.2); },
    bigHit:  () => { playNoise(0.3, 0.4); playTone(80, 'sawtooth', 0.25, 0.3); },
    levelUp: () => { [261,329,392,523].forEach((f,i) => setTimeout(() => playTone(f,'square',0.18,0.25), i*100)); },
    kiss:    () => { playTone(523,'sine',0.3,0.2); playTone(659,'sine',0.25,0.2); setTimeout(()=>playTone(784,'sine',0.4,0.25),200); },
    shoot:   () => { playNoise(0.06, 0.3); playTone(300, 'sawtooth', 0.06, 0.15, 600); },
    zombieHit: () => { playTone(180,'sawtooth',0.2,0.3,400); playNoise(0.12,0.2); },
    brain:   () => { playTone(440,'triangle',0.1,0.2); playTone(330,'sine',0.1,0.15); },
};

// ============================================================
//  GAME STATE
// ============================================================
let gameState = {
    isRunning: false, isManualPaused: false, isHoverPaused: false,
    zombieMode: false,
    score: 0, lives: 5, level: 1,
    mouseX: window.innerWidth / 2, mouseY: window.innerHeight / 2,
    penguinX: window.innerWidth / 2, penguinY: window.innerHeight / 2,
    fishes: [], snowballs: [], bluePenguins: [], bullets: [],
    lastTime: 0, startTime: 0, timeScale: 1,
    stats: { caught: 0, missed: 0 },
    kissing: false,
    weaponCooldown: 0,  // frames left before can shoot again
    weaponMaxCooldown: 60,
};

// ============================================================
//  DEVICE DETECTION & CONTROLS
// ============================================================
const isMobile = () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

window.addEventListener('mousemove', e => {
    if (!isMobile()) { gameState.mouseX = e.clientX; gameState.mouseY = e.clientY; }
});
document.addEventListener('touchmove',  e => e.preventDefault(), { passive: false });
document.addEventListener('touchstart', e => { if (!e.target.closest('button')) e.preventDefault(); }, { passive: false });

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
    joystick.startY = rect.top  + rect.height / 2;
}, { passive: true });

joystickZone.addEventListener('touchmove', e => {
    if (!joystick.active || !gameState.isRunning) return;
    e.stopPropagation();
    const touch = e.touches[0];
    let dx = touch.clientX - joystick.startX;
    let dy = touch.clientY - joystick.startY;
    const dist   = Math.sqrt(dx*dx + dy*dy);
    const capped = Math.min(dist, joystick.maxRadius);
    if (dist > 0) { dx = dx/dist*capped; dy = dy/dist*capped; }
    joystick.dx = dx; joystick.dy = dy;
    joystickKnob.style.transform = `translate(${dx}px,${dy}px)`;
    const m = 3.5;
    gameState.mouseX = gameState.penguinX + dx * m;
    gameState.mouseY = gameState.penguinY + dy * m;
}, { passive: true });

function resetJoystick() {
    joystick.active = false; joystick.dx = 0; joystick.dy = 0;
    joystickKnob.style.transform = 'translate(0,0)';
    gameState.mouseX = gameState.penguinX;
    gameState.mouseY = gameState.penguinY;
}
joystickZone.addEventListener('touchend',   resetJoystick, { passive: true });
joystickZone.addEventListener('touchcancel',resetJoystick, { passive: true });

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
//  HUD HELPERS
// ============================================================
function switchScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

function updateHUD() {
    scoreEl.innerText = gameState.score;
    levelEl.innerText = gameState.level;
    // Draw hearts
    const max = 5;
    const lives = Math.max(0, Math.min(gameState.lives, max));
    livesHeartsEl.innerText = '❤️'.repeat(lives) + '🖤'.repeat(Math.max(0, max - lives));
}

function isGamePaused() { return gameState.isManualPaused || gameState.isHoverPaused; }

// --- HOVER PAUSE (desktop only) ---
hudElement.addEventListener('mouseenter', () => { if (gameState.isRunning && !isMobile()) gameState.isHoverPaused = true; });
hudElement.addEventListener('mouseleave', () => { if (gameState.isRunning) gameState.isHoverPaused = false; });

// ============================================================
//  PAUSE BUTTON
// ============================================================
pauseBtn.addEventListener('click', () => {
    if (!gameState.isRunning) return;
    gameState.isManualPaused = !gameState.isManualPaused;
    pauseBtn.innerText = gameState.isManualPaused ? '▶' : '⏸';
    pauseBtn.classList.toggle('paused', gameState.isManualPaused);
});

// ============================================================
//  ZOMBIE MODE TOGGLE
// ============================================================
zombieBtn.addEventListener('click', () => {
    gameState.zombieMode = !gameState.zombieMode;
    const on = gameState.zombieMode;
    zombieBtn.classList.toggle('zombie-on', on);
    if (on) {
        document.body.classList.add('zombie-theme');
        gameArea.classList.add('zombie-mode-active');
        gameOverTitle.innerText = 'Zomrel si...';
    } else {
        document.body.classList.remove('zombie-theme');
        gameArea.classList.remove('zombie-mode-active');
        gameOverTitle.innerText = 'Hra skončila!';
    }
});

// ============================================================
//  WEAPON — SHOOT (Zombie mode)
// ============================================================
function fireShotgun() {
    if (!gameState.isRunning || !gameState.zombieMode || gameState.weaponCooldown > 0) return;
    SFX.shoot();
    gameState.weaponCooldown = gameState.weaponMaxCooldown;

    // Spawn 3 bullets in a spread
    const spreads = [-0.25, 0, 0.25];
    const angle = Math.atan2(gameState.mouseY - gameState.penguinY, gameState.mouseX - gameState.penguinX);

    spreads.forEach(spread => {
        const a = angle + spread;
        const speed = 12;
        const bullet = document.createElement('div');
        bullet.className = 'bullet';
        bullet.style.left = `${gameState.penguinX}px`;
        bullet.style.top  = `${gameState.penguinY}px`;
        bullet.style.transform = `translate(-50%,-50%) rotate(${a}rad)`;
        gameArea.appendChild(bullet);
        gameState.bullets.push({
            el: bullet, x: gameState.penguinX, y: gameState.penguinY,
            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
            life: 60
        });
    });
}

shootBtn.addEventListener('click', fireShotgun);
shootBtn.addEventListener('touchstart', e => { e.stopPropagation(); fireShotgun(); }, { passive: true });

// Click to shoot on desktop in zombie mode
gameArea.addEventListener('click', () => { if (gameState.zombieMode) fireShotgun(); });

// ============================================================
//  LEADERBOARD (localStorage)
// ============================================================
const LB_KEY = 'tucniak_leaderboard';

function getLeaderboard() {
    try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; }
    catch { return []; }
}

function saveLeaderboard(lb) {
    localStorage.setItem(LB_KEY, JSON.stringify(lb));
}

function addToLeaderboard(score) {
    const lb = getLeaderboard();
    lb.push({ score, date: new Date().toLocaleDateString('sk-SK') });
    lb.sort((a, b) => b.score - a.score);
    lb.splice(5); // keep top 5
    saveLeaderboard(lb);
    return lb;
}

function renderLeaderboard(currentScore) {
    const lb = addToLeaderboard(currentScore);
    leaderboardList.innerHTML = '';
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
    lb.forEach((entry, i) => {
        const li = document.createElement('li');
        const isNew = i === 0 && entry.score === currentScore;
        li.innerHTML = `${medals[i] || (i+1+'.')} <strong>${entry.score}</strong> bodov  <small>${entry.date}</small>`;
        if (isNew) { li.classList.add('new-record'); }
        leaderboardList.appendChild(li);
    });
}

// ============================================================
//  ENVIRONMENT — Water Ripples
// ============================================================
function spawnRipple() {
    const r = document.createElement('div');
    r.className = 'water-ripple';
    // Place on visible water (avoid ice floes area)
    r.style.left = `${15 + Math.random() * 70}vw`;
    r.style.top  = `${20 + Math.random() * 60}vh`;
    document.getElementById('bg-layer').appendChild(r);
    setTimeout(() => r.remove(), 3000);
}
// Spawn ripples every 1.5s
setInterval(spawnRipple, 1500);

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
    return `<svg viewBox="0 0 100 100" class="svg-fish" style="filter:drop-shadow(0 5px 5px rgba(0,0,0,.35));">
        <path d="M20,60 C10,40 30,10 50,30 C70,10 90,40 80,60 C90,80 70,100 50,80 C30,100 10,80 20,60 Z" fill="#F48FB1"/>
        <path d="M50,15 L50,90" stroke="#C2185B" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M25,40 Q40,30 50,45 Q25,60 25,40" stroke="#C2185B" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M75,40 Q60,30 50,45 Q75,60 75,40" stroke="#C2185B" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M30,70 Q45,80 50,65 Q30,60 30,70" stroke="#C2185B" stroke-width="2" fill="none"/>
        <path d="M70,70 Q55,80 50,65 Q70,60 70,70" stroke="#C2185B" stroke-width="2" fill="none"/>
        <g class="blood-drips">
            <path d="M 50,80 Q 48,110 50,115 Q 52,110 50,80" fill="#B71C1C"/>
            <circle cx="50" cy="118" r="3" fill="#B71C1C"/>
            <path d="M 30,70 Q 28,95 30,100 Q 32,95 30,70" fill="#B71C1C"/>
            <circle cx="30" cy="104" r="2.5" fill="#B71C1C"/>
            <path d="M 75,60 Q 73,85 75,90 Q 77,85 75,60" fill="#B71C1C"/>
            <circle cx="40" cy="85" r="4" fill="#B71C1C"/>
            <circle cx="65" cy="80" r="3.5" fill="#B71C1C"/>
        </g>
    </svg>`;
}

function getZombieSVG(isElite = false) {
    const headColor = isElite ? '#7B1FA2' : '#388E3C';
    const bodyColor = isElite ? '#4A148C' : '#2E7D32';
    const eyeColor  = isElite ? '#E040FB' : '#ff4d4d';
    return `<svg viewBox="0 0 100 100" class="svg-fish">
        <path d="M 15,100 C 15,60 85,60 85,100 Z" fill="${bodyColor}"/>
        <path d="M 10,100 C 25,45 75,45 90,100 Z" fill="#4E342E" opacity="0.8"/>
        <path d="M 20,100 L 25,80 L 35,100 M 70,100 L 75,85 L 85,100" fill="#1a252c"/>
        <path d="M 15,65 Q 40,55 50,75 Q 80,60 85,65" stroke="#3E2723" stroke-width="4" stroke-dasharray="8 6" fill="none"/>
        <ellipse cx="50" cy="40" rx="30" ry="35" fill="${headColor}"/>
        <path d="M 35,62 C 40,80 60,80 65,62 Z" fill="#1B5E20"/>
        <path d="M 38,62 L 42,70 L 46,62 M 54,62 L 58,70 L 62,62" stroke="#FFF" stroke-width="3" fill="none" stroke-linejoin="miter"/>
        <circle cx="35" cy="35" r="10" fill="#000"/>
        <circle cx="65" cy="35" r="10" fill="#000"/>
        <circle cx="35" cy="35" r="4" fill="${eyeColor}"/>
        <circle cx="65" cy="35" r="4" fill="${eyeColor}"/>
        ${isElite ? '<path d="M 35,18 L 50,8 L 65,18" stroke="#E040FB" stroke-width="3" fill="none"/>' : ''}
        <path d="M 55,10 C 65,5 75,20 65,25 C 55,20 50,15 55,10 Z" fill="#F48FB1"/>
        <path d="M 30,20 L 45,30 M 35,15 L 40,35" stroke="#B71C1C" stroke-width="3"/>
        <path d="M 10,75 Q -5,55 10,45" stroke="${headColor}" stroke-width="12" stroke-linecap="round" fill="none"/>
        <path d="M 90,75 Q 105,55 90,45" stroke="${headColor}" stroke-width="12" stroke-linecap="round" fill="none"/>
    </svg>`;
}

// Blue penguin SVG (with zombie gear slot)
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
    gameState.score   = 0;
    gameState.lives   = 5;
    gameState.level   = 1;
    gameState.stats.caught = 0;
    gameState.stats.missed = 0;
    gameState.startTime = Date.now();
    gameState.isRunning = true;
    gameState.isManualPaused  = false;
    gameState.isHoverPaused   = false;
    gameState.timeScale = 1;
    gameState.kissing  = false;
    gameState.weaponCooldown = 0;
    pauseBtn.innerText = '⏸';
    pauseBtn.classList.remove('paused');
    penguinWrap.classList.remove('kissing-animation','kissing-rotate-left');

    document.querySelectorAll('.fish,.snowball,.explosion,.zombie-explosion,.blue-penguin-wrap,.kiss-heart,.bullet')
        .forEach(el => el.remove());
    gameState.fishes       = [];
    gameState.snowballs    = [];
    gameState.bluePenguins = [];
    gameState.bullets      = [];

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
    setTimeout(() => h.remove(), 1500);
}

// ============================================================
//  SPAWNERS
// ============================================================
function spawnFish() {
    if (!gameState.isRunning) return;
    const div = document.createElement('div');
    div.className = 'fish';
    let points = 1;
    let colorBody = '#FFC107', colorTail = '#FFA000';

    if (gameState.level >= 2 && Math.random() < 0.2) {
        div.classList.add('rare'); points = 2;
        colorBody = '#29B6F6'; colorTail = '#0288D1';
    } else if (gameState.level >= 3 && Math.random() < 0.1) {
        div.classList.add('epic'); points = 3;
        colorBody = '#AB47BC'; colorTail = '#7B1FA2';
    }

    if (gameState.zombieMode) {
        div.innerHTML = getBrainSVG();
    } else {
        div.innerHTML = getFishSVG(colorBody, colorTail);
    }

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
    const angle = Math.atan2(window.innerHeight/2 - y, window.innerWidth/2 - x);
    gameState.bluePenguins.push({ el: div, x, y, vx: Math.cos(angle)*1.5, vy: Math.sin(angle)*1.5 });
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
    gameState.snowballs.push({ el: div, x: x + size/2, y: y + size/2, vx, vy, damage, isElite });
}

// ============================================================
//  COLLISIONS
// ============================================================
function checkCollisions() {
    if (gameState.kissing) return;
    const penR = 28;

    // Fish
    for (let i = gameState.fishes.length - 1; i >= 0; i--) {
        const f  = gameState.fishes[i];
        const dx = gameState.penguinX - f.x;
        const dy = gameState.penguinY - f.y;
        if (Math.sqrt(dx*dx + dy*dy) < penR + 22) {
            f.el.remove(); gameState.fishes.splice(i, 1);
            gameState.score += f.points; gameState.stats.caught++;
            if (f.points === 3) SFX.epic();
            else if (f.points === 2) SFX.rare();
            else gameState.zombieMode ? SFX.brain() : SFX.fish();
            if (gameState.score >= gameState.level * 6) levelUp(); else spawnFish();
            updateHUD();
        }
    }

    // Snowballs / Zombies
    for (let i = gameState.snowballs.length - 1; i >= 0; i--) {
        const sb = gameState.snowballs[i];
        const dx = gameState.penguinX - sb.x;
        const dy = gameState.penguinY - sb.y;
        if (Math.sqrt(dx*dx + dy*dy) < penR + 26) {
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

    // Bullets vs Zombies
    if (gameState.zombieMode) {
        for (let bi = gameState.bullets.length - 1; bi >= 0; bi--) {
            const b = gameState.bullets[bi];
            let hit = false;
            for (let si = gameState.snowballs.length - 1; si >= 0; si--) {
                const sb = gameState.snowballs[si];
                const dx = b.x - sb.x, dy = b.y - sb.y;
                if (Math.sqrt(dx*dx + dy*dy) < 30) {
                    SFX.zombieHit();
                    createExplosion(sb.x, sb.y, true);
                    gameState.score += sb.isElite ? 2 : 1;
                    sb.el.remove(); gameState.snowballs.splice(si, 1);
                    updateHUD();
                    hit = true; break;
                }
            }
            if (hit) { b.el.remove(); gameState.bullets.splice(bi, 1); }
        }
    }

    // Blue penguin kiss
    for (let i = gameState.bluePenguins.length - 1; i >= 0; i--) {
        const bp = gameState.bluePenguins[i];
        const dx = gameState.penguinX - bp.x;
        const dy = gameState.penguinY - bp.y;
        if (Math.sqrt(dx*dx + dy*dy) < penR + 30) {
            gameState.kissing = true;
            gameState.timeScale = 0.05;
            SFX.kiss();
            const cx = window.innerWidth/2, cy = window.innerHeight/2;
            penguinWrap.classList.add('kissing-animation','kissing-rotate-left');
            penguinWrap.style.left = `${cx - 50}px`;
            penguinWrap.style.top  = `${cy}px`;
            bp.el.classList.add('kissing-animation','kissing-rotate-right');
            bp.el.style.left = `${cx + 50}px`;
            bp.el.style.top  = `${cy}px`;
            setTimeout(() => spawnKissHeart(cx, cy - 80), 800);
            gameState.lives += 3; updateHUD();
            setTimeout(() => {
                bp.el.remove(); gameState.bluePenguins.splice(i, 1);
                gameState.kissing = false;
                penguinWrap.classList.remove('kissing-animation','kissing-rotate-left');
                gameState.timeScale = 1;
            }, 2500);
        }
    }
}

// ============================================================
//  LEVEL UP
// ============================================================
function levelUp() {
    gameState.level++;
    SFX.levelUp();
    levelUpOverlay.querySelector('h2').innerText = `Level ${gameState.level}! 🎉`;
    levelUpOverlay.classList.remove('hidden');
    setTimeout(() => {
        levelUpOverlay.classList.add('hidden');
        spawnFish();
        if (gameState.level > 1) spawnSnowball();
    }, 1500);
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
        if (sb.x < -250 || sb.x > window.innerWidth+250 || sb.y < -250 || sb.y > window.innerHeight+250) {
            sb.el.remove(); gameState.snowballs.splice(i, 1);
        }
    }

    // --- Bullets ---
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        const b = gameState.bullets[i];
        b.x += b.vx; b.y += b.vy; b.life--;
        b.el.style.left = `${b.x}px`; b.el.style.top = `${b.y}px`;
        if (b.life <= 0 || b.x < 0 || b.x > window.innerWidth || b.y < 0 || b.y > window.innerHeight) {
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

    // --- Weapon cooldown ---
    if (gameState.weaponCooldown > 0) {
        gameState.weaponCooldown -= ts;
        const pct = Math.max(0, 1 - gameState.weaponCooldown / gameState.weaponMaxCooldown);
        if (weaponBarFill) weaponBarFill.style.transform = `scaleX(${pct})`;
    }

    // --- Spawn logic ---
    const spawnChance = (0.005 + gameState.level * 0.002) * ts;
    const maxSB = gameState.level + 1;
    if (gameState.level > 1 && Math.random() < spawnChance && gameState.snowballs.length < maxSB) spawnSnowball();
    if (Math.random() < 0.001 * ts && gameState.bluePenguins.length === 0 && !gameState.kissing) spawnBluePenguin();

    checkCollisions();
    requestAnimationFrame(gameLoop);
}
