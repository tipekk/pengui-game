const screens = {
    menu: document.getElementById('main-menu'),
    game: document.getElementById('game-screen'),
    gameOver: document.getElementById('game-over-screen')
};

const penguinWrap = document.getElementById('player-penguin');
const gameArea = document.getElementById('game-area');
const hudElement = document.getElementById('hud'); // Top Menu

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');

// Stats Elements
const statCaughtEl = document.getElementById('stat-caught');
const statMissedEl = document.getElementById('stat-missed');
const statTimeEl = document.getElementById('stat-time');
const finalScoreEl = document.getElementById('final-score');
const levelUpOverlay = document.getElementById('level-up-overlay');

const pauseBtn = document.getElementById('pause-btn');
const zombieBtn = document.getElementById('zombie-btn');

let gameState = {
    isRunning: false,
    isManualPaused: false,
    isHoverPaused: false,
    zombieMode: false,
    score: 0,
    lives: 5,
    level: 1,
    mouseX: window.innerWidth / 2,
    mouseY: window.innerHeight / 2,
    penguinX: window.innerWidth / 2,
    penguinY: window.innerHeight / 2,
    fishes: [],
    snowballs: [],
    bluePenguins: [],
    lastTime: 0,
    startTime: 0,
    timeScale: 1,
    stats: {
        caught: 0,
        missed: 0
    },
    kissing: false // flag na zablokovanie pohybu pocas animacie
};

// Controls
window.addEventListener('mousemove', (e) => {
    gameState.mouseX = e.clientX;
    gameState.mouseY = e.clientY;
});

window.addEventListener('touchmove', (e) => {
    if(e.touches.length > 0) {
        gameState.mouseX = e.touches[0].clientX;
        gameState.mouseY = e.touches[0].clientY;
    }
});

function switchScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

hudElement.addEventListener('mouseenter', () => {
    if(gameState.isRunning) gameState.isHoverPaused = true;
});
hudElement.addEventListener('mouseleave', () => {
    if(gameState.isRunning) gameState.isHoverPaused = false;
});

// Update Pause state
function isGamePaused() {
    return gameState.isManualPaused || gameState.isHoverPaused;
}

pauseBtn.addEventListener('click', () => {
    if(!gameState.isRunning) return;
    gameState.isManualPaused = !gameState.isManualPaused;
    pauseBtn.innerText = gameState.isManualPaused ? "▶ Pokračovať" : "⏸ Pauza";
});

zombieBtn.addEventListener('click', () => {
    gameState.zombieMode = !gameState.zombieMode;
    zombieBtn.innerText = gameState.zombieMode ? "🐟 Vypnúť Zombie" : "🧟 Zombíci (Vyp)";
    zombieBtn.style.backgroundColor = gameState.zombieMode ? "#f44336" : "#4caf50";
    
    // Toggle global CSS
    if (gameState.zombieMode) {
        document.body.classList.add('zombie-theme');
    } else {
        document.body.classList.remove('zombie-theme');
    }
});

function startGame() {
    gameState.score = 0;
    gameState.lives = 5;
    gameState.level = 1;
    gameState.stats.caught = 0;
    gameState.stats.missed = 0;
    gameState.startTime = Date.now();
    gameState.isRunning = true;
    gameState.isManualPaused = false;
    gameState.isHoverPaused = false;
    pauseBtn.innerText = "⏸ Pauza";
    gameState.timeScale = 1;
    gameState.kissing = false;
    penguinWrap.classList.remove('kissing-animation', 'kissing-rotate-left');
    
    updateHUD();
    
    document.querySelectorAll('.fish, .snowball, .explosion, .blue-penguin-wrap, .kiss-heart').forEach(el => el.remove());
    gameState.fishes = [];
    gameState.snowballs = [];
    gameState.bluePenguins = [];
    
    switchScreen('game');
    spawnFish();
    requestAnimationFrame(gameLoop);
}

function endGame() {
    gameState.isRunning = false;
    
    // Fill stats
    const timeSpent = Math.floor((Date.now() - gameState.startTime) / 1000);
    statCaughtEl.innerText = gameState.stats.caught;
    statMissedEl.innerText = gameState.stats.missed;
    statTimeEl.innerText = timeSpent;
    finalScoreEl.innerText = gameState.score;
    
    switchScreen('gameOver');
}

function updateHUD() {
    scoreEl.innerText = gameState.score;
    livesEl.innerText = gameState.lives;
    levelEl.innerText = gameState.level;
}

function createExplosion(x, y) {
    const explosion = document.createElement('div');
    explosion.className = 'explosion';
    explosion.style.left = `${x}px`;
    explosion.style.top = `${y}px`;
    gameArea.appendChild(explosion);
    setTimeout(() => explosion.remove(), 400);
}

function spawnKissHeart(x, y) {
    const heart = document.createElement('div');
    heart.className = 'kiss-heart';
    heart.innerText = '💙'; // Modré srdce :D
    heart.style.left = `${x}px`;
    heart.style.top = `${y}px`;
    gameArea.appendChild(heart);
    setTimeout(() => heart.remove(), 1500);
}

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
    return `<svg viewBox="0 0 100 100" class="svg-fish" style="filter: drop-shadow(0 5px 5px rgba(0,0,0,0.3));">
        <!-- Mozgové pľúca s krvavým okrajom -->
        <path d="M20,60 C10,40 30,10 50,30 C70,10 90,40 80,60 C90,80 70,100 50,80 C30,100 10,80 20,60 Z" fill="#F48FB1"/>
        <!-- Centrálna brázda -->
        <path d="M50,15 L50,90" stroke="#C2185B" stroke-width="4" fill="none" stroke-linecap="round"/>
        <!-- Závity -->
        <path d="M25,40 Q40,30 50,45 Q25,60 25,40" stroke="#C2185B" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M75,40 Q60,30 50,45 Q75,60 75,40" stroke="#C2185B" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M30,70 Q45,80 50,65 Q30,60 30,70" stroke="#C2185B" stroke-width="2" fill="none"/>
        <path d="M70,70 Q55,80 50,65 Q70,60 70,70" stroke="#C2185B" stroke-width="2" fill="none"/>
        <!-- KVAPKAJÚCA KRV (Viac krvi!!!) -->
        <g class="blood-drips">
            <path d="M 50,80 Q 48,110 50,115 Q 52,110 50,80" fill="#B71C1C"/>
            <circle cx="50" cy="118" r="3" fill="#B71C1C"/>
            <path d="M 30,70 Q 28,95 30,100 Q 32,95 30,70" fill="#B71C1C"/>
            <circle cx="30" cy="104" r="2.5" fill="#B71C1C"/>
            <path d="M 75,60 Q 73,85 75,90 Q 77,85 75,60" fill="#B71C1C"/>
            <circle cx="75" cy="94" r="2" fill="#B71C1C"/>
            <circle cx="40" cy="85" r="4" fill="#B71C1C"/>
            <circle cx="65" cy="80" r="3.5" fill="#B71C1C"/>
        </g>
    </svg>`;
}

function getZombieSVG() {
    return `<svg viewBox="0 0 100 100" class="svg-fish">
        <!-- Zelené hnijúce telo s ramenami v popredí -->
        <path d="M 15,100 C 15,60 85,60 85,100 Z" fill="#2E7D32"/>
        <!-- Roztrhané Zombie Oblečenie -->
        <path d="M 10,100 C 25,45 75,45 90,100 Z" fill="#4E342E" opacity="0.8"/>
        <path d="M 20,100 L 25,80 L 35,100 M 70,100 L 75,85 L 85,100" fill="#1a252c"/>
        <path d="M 15,65 Q 40,55 50,75 Q 80,60 85,65" stroke="#3E2723" stroke-width="4" stroke-dasharray="8 6" fill="none"/>
        
        <!-- Zombie Hlava -->
        <ellipse cx="50" cy="40" rx="30" ry="35" fill="#4CAF50"/>
        
        <!-- Otvorená sánka a zuby -->
        <path d="M 35,62 C 40,80 60,80 65,62 Z" fill="#1B5E20"/>
        <!-- Krivé zubiská -->
        <path d="M 38,62 L 42,70 L 46,62 M 54,62 L 58,70 L 62,62" stroke="#FFF" stroke-width="3" fill="none" stroke-linejoin="miter"/>
        
        <!-- Hrozostrašné Oči -->
        <circle cx="35" cy="35" r="10" fill="#000"/>
        <circle cx="65" cy="35" r="10" fill="#000"/>
        <circle cx="35" cy="35" r="3" fill="#ff4d4d"/> <!-- Očné zreničky glow -->
        <circle cx="65" cy="35" r="3" fill="#ff4d4d"/>
        
        <!-- Jazvy a odhalený mozog na hlave -->
        <path d="M 55,10 C 65,5 75,20 65,25 C 55,20 50,15 55,10 Z" fill="#F48FB1"/> <!-- Mozog -->
        <path d="M 55,10 C 65,5 75,20 65,25" stroke="#B71C1C" stroke-width="2" fill="none"/>
        <path d="M 30,20 L 45,30 M 35,15 L 40,35" stroke="#B71C1C" stroke-width="3"/> <!-- Stehy -->
        
        <!-- Ruky natiahnuté dopredu (zombie walk) -->
        <path d="M 10,75 Q -5,55 10,45" stroke="#4CAF50" stroke-width="12" stroke-linecap="round" fill="none"/>
        <path d="M 90,75 Q 105,55 90,45" stroke="#4CAF50" stroke-width="12" stroke-linecap="round" fill="none"/>
    </svg>`;
}

function spawnFish() {
    if (!gameState.isRunning) return;
    
    const fishDiv = document.createElement('div');
    fishDiv.className = 'fish';
    
    let points = 1;
    let type = 'normal';
    
    if (gameState.level >= 2 && Math.random() < 0.2) {
        fishDiv.classList.add('rare');
        points = 2; type = 'rare';
    } else if (gameState.level >= 3 && Math.random() < 0.1) {
        fishDiv.classList.add('epic');
        points = 3; type = 'epic';
    }
    
    if (gameState.zombieMode) {
        fishDiv.innerHTML = getBrainSVG();
    } else {
        fishDiv.innerHTML = getFishSVG('#FFC107', '#FFA000');
    }
    
    const padding = 80;
    const x = padding + Math.random() * (window.innerWidth - padding * 2);
    const y = padding + Math.random() * (window.innerHeight - padding * 2);
    
    fishDiv.style.left = `${x}px`;
    fishDiv.style.top = `${y}px`;
    gameArea.appendChild(fishDiv);
    
    gameState.fishes.push({
        el: fishDiv, x: x, y: y,
        points: points,
        lifetime: 500 + Math.random() * 200 // lifetime frames pred zmiznutím
    });
}

const pSVG = `<svg viewBox="0 0 100 100" class="svg-penguin" style="--skin-color: #03A9F4;">
<ellipse cx="30" cy="90" rx="15" ry="8" fill="#FF9800"/><ellipse cx="70" cy="90" rx="15" ry="8" fill="#FF9800"/><ellipse cx="50" cy="55" rx="40" ry="45" fill="var(--skin-color)"/><ellipse cx="50" cy="65" rx="30" ry="30" fill="#FFF"/>

<!-- Zombie gear base template pre modrého tučniaka! Aj on je drsňák -->
<g class="zombie-gear">
    <path d="M 12,33 L 60,47" stroke="#111" stroke-width="2.5"/>
    <circle cx="35" cy="40" r="9" fill="#222"/>
    <path d="M 17,55 Q 50,75 83,60" fill="none" stroke="#5D4037" stroke-width="8"/>
    <rect x="25" y="58" width="4" height="12" fill="#FFC107" transform="rotate(-15 27 64)"/>
    <rect x="40" y="62" width="4" height="12" fill="#FFC107" transform="rotate(-5 42 68)"/>
    <rect x="55" y="62" width="4" height="12" fill="#FFC107" transform="rotate(5 57 68)"/>
    <rect x="70" y="58" width="4" height="12" fill="#FFC107" transform="rotate(15 72 64)"/>
    <g transform="translate(65, 45) rotate(-45)">
        <rect x="-15" y="-3" width="18" height="8" fill="#4E342E" rx="2"/>
        <rect x="3" y="-3" width="35" height="4" fill="#546E7A"/>
        <rect x="3" y="2" width="35" height="4" fill="#546E7A"/>
        <path d="M 5,6 L 5,12 L -2,12" stroke="#212121" stroke-width="2" fill="none"/>
    </g>
</g>

<ellipse cx="10" cy="60" rx="10" ry="25" fill="var(--skin-color)" transform="rotate(20 10 60)"/>
<ellipse cx="90" cy="60" rx="10" ry="25" fill="var(--skin-color)" transform="rotate(-20 90 60)"/>
<circle cx="35" cy="40" r="5" fill="#000"/><circle cx="65" cy="40" r="5" fill="#000"/><circle cx="37" cy="38" r="2" fill="#fff"/><circle cx="67" cy="38" r="2" fill="#fff"/><path d="M 45,46 L 55,46 L 50,52 Z" fill="#FF9800"/>
</svg>`;

function spawnBluePenguin() {
    if (!gameState.isRunning) return;
    
    const bluePen = document.createElement('div');
    bluePen.className = 'blue-penguin-wrap';
    bluePen.innerHTML = pSVG;
    
    const x = Math.random() < 0.5 ? 50 : window.innerWidth - 50;
    const y = Math.random() < 0.5 ? 50 : window.innerHeight - 50;
    
    bluePen.style.left = `${x}px`;
    bluePen.style.top = `${y}px`;
    gameArea.appendChild(bluePen);
    
    const targetX = window.innerWidth / 2;
    const targetY = window.innerHeight / 2;
    const angle = Math.atan2(targetY - y, targetX - x);
    
    gameState.bluePenguins.push({
        el: bluePen, x: x, y: y,
        vx: Math.cos(angle) * 1.5, vy: Math.sin(angle) * 1.5
    });
}

function spawnSnowball() {
    if (!gameState.isRunning) return;
    
    const sbDiv = document.createElement('div');
    sbDiv.className = 'snowball';
    
    let isRed = false;
    let damage = 1;
    if (gameState.level >= 2 && Math.random() < 0.3) {
        if (!gameState.zombieMode) sbDiv.classList.add('red');
        isRed = true; damage = 3;
    }
    
    if (gameState.zombieMode) {
        sbDiv.classList.add('zombie-item');
        sbDiv.innerHTML = getZombieSVG();
        if(isRed) sbDiv.style.filter = "hue-rotate(300deg)"; // "Červený zombík = Mutovaný rýchly"
    }
    
    const size = 70; let x, y, vx, vy;
    const baseSpeed = 2 + (gameState.level * 0.5);
    const m = isRed ? 1.5 : 1; 
    
    if (Math.random() < 0.5) { 
        x = Math.random() * window.innerWidth;
        y = Math.random() < 0.5 ? -size : window.innerHeight + size;
        vx = (Math.random() - 0.5) * 4 * m;
        vy = (y < 0 ? 1 : -1) * (baseSpeed + Math.random() * 2) * m;
    } else { 
        x = Math.random() < 0.5 ? -size : window.innerWidth + size;
        y = Math.random() * window.innerHeight;
        vx = (x < 0 ? 1 : -1) * (baseSpeed + Math.random() * 2) * m;
        vy = (Math.random() - 0.5) * 4 * m;
    }
    gameArea.appendChild(sbDiv);
    
    gameState.snowballs.push({
        el: sbDiv, x: x + size/2, y: y + size/2, vx, vy, damage
    });
}

function checkCollisions() {
    if(gameState.kissing) return; // Vypnúť kolízie počas kissing animácie
    
    const penR = 30; // Radius tučniaka
    
    // ryby
    for (let i = gameState.fishes.length - 1; i >= 0; i--) {
        const fish = gameState.fishes[i];
        const dx = gameState.penguinX - fish.x;
        const dy = gameState.penguinY - fish.y;
        
        if (Math.sqrt(dx*dx + dy*dy) < penR + 25) { 
            fish.el.remove();
            gameState.fishes.splice(i, 1);
            gameState.score += fish.points;
            gameState.stats.caught += 1;
            
            if (gameState.score >= gameState.level * 6) levelUp();
            else spawnFish();
            
            updateHUD();
        }
    }
    
    // snehove gule
    for (let i = gameState.snowballs.length - 1; i >= 0; i--) {
        const sb = gameState.snowballs[i];
        const dx = gameState.penguinX - sb.x;
        const dy = gameState.penguinY - sb.y;
        
        if (Math.sqrt(dx*dx + dy*dy) < penR + 25) {
            createExplosion(sb.x, sb.y);
            gameState.lives -= sb.damage;
            sb.el.remove();
            gameState.snowballs.splice(i, 1);
            updateHUD();
            
            if (gameState.lives <= 0) {
                gameState.lives = 0; updateHUD();
                setTimeout(() => endGame(), 300); return;
            }
        }
    }
    
    // modry tucniak => KISSING animacia
    for (let i = gameState.bluePenguins.length - 1; i >= 0; i--) {
        const bp = gameState.bluePenguins[i];
        const dx = gameState.penguinX - bp.x;
        const dy = gameState.penguinY - bp.y;
        
        if (Math.sqrt(dx*dx + dy*dy) < penR + 30) { 
            gameState.kissing = true;
            gameState.timeScale = 0.05; // extremne slow mo okolia
            
            // Fix position to center of screen for the kiss
            const cx = window.innerWidth/2;
            const cy = window.innerHeight/2;
            
            // Move player
            penguinWrap.classList.add('kissing-animation', 'kissing-rotate-left');
            penguinWrap.style.left = `${cx - 50}px`;
            penguinWrap.style.top = `${cy}px`;
            
            // Move blue penguin
            bp.el.classList.add('kissing-animation', 'kissing-rotate-right');
            bp.el.style.left = `${cx + 50}px`;
            bp.el.style.top = `${cy}px`;
            
            // Ukázanie plnokrvného srdiečka nad ich hlavami v 3D priestore
            setTimeout(() => spawnKissHeart(cx, cy - 80), 800); 
            
            gameState.lives += 3;
            updateHUD();
            
            setTimeout(() => {
                bp.el.remove();
                gameState.bluePenguins.splice(i, 1);
                gameState.kissing = false;
                penguinWrap.classList.remove('kissing-animation', 'kissing-rotate-left');
                gameState.timeScale = 1;
            }, 2500); // doba bozkávania natiahnutá na 2.5s kvôli výletu z 3D
        }
    }
}

function levelUp() {
    gameState.level++;
    levelUpOverlay.querySelector('h2').innerText = `Level ${gameState.level} !`;
    levelUpOverlay.classList.remove('hidden');
    
    setTimeout(() => {
        levelUpOverlay.classList.add('hidden');
        spawnFish();
        if (gameState.level > 1) spawnSnowball();
    }, 1500);
}

function gameLoop(timestamp) {
    if (!gameState.isRunning) return;
    
    gameState.lastTime = timestamp;
    
    if (isGamePaused()) {
        requestAnimationFrame(gameLoop);
        return;
    }

    const ts = gameState.timeScale;

    // Pohyb tucniaka iba ak sa nebozkava
    if (!gameState.kissing) {
        const speed = 0.1 * ts;
        gameState.penguinX += (gameState.mouseX - gameState.penguinX) * speed;
        gameState.penguinY += (gameState.mouseY - gameState.penguinY) * speed;
        
        const vx = (gameState.mouseX - gameState.penguinX) * speed;
        const tilt = vx > 0.5 ? 20 : (vx < -0.5 ? -20 : 0);
        
        penguinWrap.style.transform = `translate(-50%, -50%) rotate(${tilt}deg)`;
        penguinWrap.style.left = `${gameState.penguinX}px`;
        penguinWrap.style.top = `${gameState.penguinY}px`;
    }
    
    // Fish lifetime logic
    for (let i = gameState.fishes.length - 1; i >= 0; i--) {
        const fish = gameState.fishes[i];
        fish.lifetime -= 1 * ts;
        
        if (fish.lifetime < 100) fish.el.classList.add('fading');
        
        if (fish.lifetime <= 0) {
            fish.el.remove();
            gameState.fishes.splice(i, 1);
            gameState.stats.missed += 1;
            spawnFish(); // nahradi ujdete rybu
        }
    }
    
    for (let i = gameState.snowballs.length - 1; i >= 0; i--) {
        const sb = gameState.snowballs[i];
        sb.x += sb.vx * ts;
        sb.y += sb.vy * ts;
        sb.el.style.left = `${sb.x - 35}px`; 
        sb.el.style.top = `${sb.y - 35}px`;
        
        if (sb.x < -200 || sb.x > window.innerWidth + 200 || sb.y < -200 || sb.y > window.innerHeight + 200) {
            sb.el.remove();
            gameState.snowballs.splice(i, 1);
        }
    }
    
    for (let i = gameState.bluePenguins.length - 1; i >= 0; i--) {
        if(gameState.kissing) break; // Zastaví ho počas bozkávania
        const bp = gameState.bluePenguins[i];
        bp.x += bp.vx * ts;
        bp.y += bp.vy * ts;
        bp.el.style.left = `${bp.x - 40}px`;
        bp.el.style.top = `${bp.y - 40}px`;
    }
    
    const spawnChance = (0.005 + (gameState.level * 0.002)) * ts;
    const maxSnowballs = gameState.level + 1;
    if (gameState.level > 1 && Math.random() < spawnChance && gameState.snowballs.length < maxSnowballs) {
        spawnSnowball();
    }
    
    if (Math.random() < 0.001 * ts && gameState.bluePenguins.length === 0 && !gameState.kissing) {
         spawnBluePenguin();
    }
    
    checkCollisions();
    requestAnimationFrame(gameLoop);
}
