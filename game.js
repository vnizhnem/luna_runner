// =================== НАСТРОЙКИ ===================
const CONFIG = {
    BASE_SPEED: 10,           // Удвоили стартовую скорость (было 5)
    GRAVITY: 0.8,
    JUMP_FORCE: -18,
    HERO_WIDTH: 128,
    HERO_HEIGHT: 128,
    MONSTER_WIDTH: 60,
    MONSTER_HEIGHT: 60,
    BONUS_SIZE: 40,           // Чуть меньше для мобильных
    SPAWN_INTERVAL: 1200,     // Быстрее спавн
    BONUS_SPAWN_CHANCE: 0.4,
    MONSTER_SPAWN_CHANCE: 0.6,
    BONUS_MAX_HEIGHT: 450,
    BONUS_MIN_HEIGHT: 250,
    DOUBLE_JUMP_ENABLED: true,
    DOUBLE_JUMP_FORCE: -16,
    SPEED_INCREASE_PER_5_BONUSES: 2.0, // +2.0 скорости за каждые 5 бонусов
    MAX_SPEED: 20,
    CANVAS_RATIO: 4/3         // Соотношение для адаптивности
};

// =================== ПЕРЕМЕННЫЕ ===================
let canvas, ctx;
let gameRunning = false;
let gameOver = false;
let score = 0;
let highScore = localStorage.getItem('lunaHighScore') || 0;
let gameSpeed = CONFIG.BASE_SPEED;
let totalBonusesCollected = 0;
let speedLevel = 2.0; // Начинаем с x2.0

let bonusStats = {
    ice: 0, fire: 0, orange: 0, pineapple: 0, coal: 0
};

// =================== ОБЪЕКТЫ ===================
const hero = {
    x: 150,
    y: 0, // Будет установлено после загрузки
    width: CONFIG.HERO_WIDTH,
    height: CONFIG.HERO_HEIGHT,
    velocityY: 0,
    isJumping: false,
    isOnGround: true,
    canDoubleJump: false,
    jumpCount: 0
};

const background = {
    x1: 0,
    x2: 0, // Будет установлено после загрузки
    speed: CONFIG.BASE_SPEED * 0.5
};

let monsters = [];
let bonuses = [];
let spawnTimer = 0;

// =================== РАЗМЕРЫ КАНВАСА ===================
function getCanvasSize() {
    const gameArea = document.querySelector('.game-area');
    const width = gameArea.clientWidth;
    const height = Math.min(width * CONFIG.CANVAS_RATIO, window.innerHeight * 0.6);
    
    return { width, height };
}

function resizeCanvas() {
    const size = getCanvasSize();
    
    canvas.width = size.width;
    canvas.height = size.height;
    
    // Пересчитываем позиции
    hero.y = size.height - CONFIG.HERO_HEIGHT - 30;
    background.x2 = size.width;
    
    // Перерисовываем если игра не запущена
    if (!gameRunning) {
        renderStartScreen();
    }
}

// =================== ИНИЦИАЛИЗАЦИЯ ===================
async function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Настройка размеров
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', () => {
        setTimeout(resizeCanvas, 100);
    });
    
    // Рекорд и скорость
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('speedLevel').textContent = `x${speedLevel.toFixed(1)}`;
    updateBonusCounters();
    
    // Обработчики
    setupEventListeners();
    
    // Стартовый экран
    renderStartScreen();
}

function setupEventListeners() {
    // Тап на весь канвас
    canvas.addEventListener('click', handleJump);
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleJump();
    }, { passive: false });
    
    // Пробел и Enter
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            handleJump();
            e.preventDefault();
        }
        if (e.code === 'Enter' && !gameRunning) {
            startGame();
        }
    });
    
    // Кнопки
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('restartBtn').addEventListener('click', restartGame);
}

// =================== ИГРОВОЙ ЦИКЛ ===================
function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    
    gameRunning = true;
    gameOver = false;
    score = 0;
    gameSpeed = CONFIG.BASE_SPEED;
    speedLevel = 2.0;
    totalBonusesCollected = 0;
    
    // Сброс статистики
    bonusStats = { ice: 0, fire: 0, orange: 0, pineapple: 0, coal: 0 };
    updateBonusCounters();
    updateSpeedDisplay();
    
    // Сброс героя
    hero.y = canvas.height - CONFIG.HERO_HEIGHT - 30;
    hero.velocityY = 0;
    hero.isJumping = false;
    hero.isOnGround = true;
    hero.canDoubleJump = false;
    hero.jumpCount = 0;
    
    monsters = [];
    bonuses = [];
    spawnTimer = 0;
    
    // Обновить UI
    document.getElementById('currentScore').textContent = score;
    
    // Запуск
    requestAnimationFrame(gameLoop);
}

function gameLoop() {
    if (!gameRunning) return;
    
    update();
    render();
    
    requestAnimationFrame(gameLoop);
}

function update() {
    // Спавн
    if (spawnTimer <= 0) {
        spawnObjects();
        spawnTimer = CONFIG.SPAWN_INTERVAL;
    } else {
        spawnTimer -= 1000 / 60;
    }
    
    // Физика героя
    hero.velocityY += CONFIG.GRAVITY;
    hero.y += hero.velocityY;
    
    // Земля
    const groundLevel = canvas.height - CONFIG.HERO_HEIGHT - 30;
    if (hero.y > groundLevel) {
        hero.y = groundLevel;
        hero.velocityY = 0;
        hero.isJumping = false;
        hero.isOnGround = true;
        hero.jumpCount = 0;
        hero.canDoubleJump = false;
    }
    
    // Фон
    background.x1 -= background.speed;
    background.x2 -= background.speed;
    
    if (background.x1 <= -canvas.width) {
        background.x1 = canvas.width;
    }
    if (background.x2 <= -canvas.width) {
        background.x2 = canvas.width;
    }
    
    // Монстры
    for (let i = monsters.length - 1; i >= 0; i--) {
        monsters[i].x -= gameSpeed;
        
        if (checkCollision(hero, monsters[i])) {
            endGame();
            return;
        }
        
        if (monsters[i].x < -CONFIG.MONSTER_WIDTH) {
            monsters.splice(i, 1);
        }
    }
    
    // Бонусы
    for (let i = bonuses.length - 1; i >= 0; i--) {
        bonuses[i].x -= gameSpeed;
        
        if (checkCollision(hero, bonuses[i])) {
            collectBonus(bonuses[i]);
            bonuses.splice(i, 1);
        }
        else if (bonuses[i].x < -CONFIG.BONUS_SIZE) {
            bonuses.splice(i, 1);
        }
    }
}

function render() {
    // Очистка
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Запасной фон
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Бонусы
    bonuses.forEach(bonus => {
        const pulse = Math.sin(Date.now() * 0.005) * 3;
        const size = CONFIG.BONUS_SIZE + pulse;
        const offset = (CONFIG.BONUS_SIZE - size) / 2;
        
        ctx.save();
        ctx.globalAlpha = 0.9;
        
        // Рисуем кружок под бонусом
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.arc(
            bonus.x + CONFIG.BONUS_SIZE/2,
            bonus.y + CONFIG.BONUS_SIZE/2,
            size/2,
            0, Math.PI * 2
        );
        ctx.fill();
        
        // Текст названия бонуса
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            getBonusName(bonus.type),
            bonus.x + CONFIG.BONUS_SIZE/2,
            bonus.y - 5
        );
        
        ctx.restore();
    });
    
    // Монстры
    monsters.forEach(monster => {
        ctx.save();
        // Тень под монстром
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(
            monster.x + 5,
            monster.y + monster.height - 5,
            monster.width - 10,
            10
        );
        ctx.restore();
    });
    
    // Герой с тенью
    ctx.save();
    // Тень
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(
        hero.x + hero.width/2,
        hero.y + hero.height + 5,
        hero.width/3 * (1 + Math.abs(hero.velocityY * 0.1)),
        hero.height/8,
        0, 0, Math.PI * 2
    );
    ctx.fill();
    
    // Контур героя при прыжке
    if (hero.isJumping) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(hero.x, hero.y, hero.width, hero.height);
    }
    ctx.restore();
}

// =================== ИГРОВЫЕ ФУНКЦИИ ===================
function handleJump() {
    if (!gameRunning || gameOver) return;
    
    if (hero.isOnGround) {
        // Первый прыжок
        hero.velocityY = CONFIG.JUMP_FORCE;
        hero.isJumping = true;
        hero.isOnGround = false;
        hero.jumpCount = 1;
        hero.canDoubleJump = true;
    } 
    else if (CONFIG.DOUBLE_JUMP_ENABLED && hero.canDoubleJump && hero.jumpCount < 2) {
        // Двойной прыжок
        hero.velocityY = CONFIG.DOUBLE_JUMP_FORCE;
        hero.jumpCount = 2;
        hero.canDoubleJump = false;
    }
}

function spawnObjects() {
    // Монстры
    if (Math.random() < CONFIG.MONSTER_SPAWN_CHANCE) {
        monsters.push({
            x: canvas.width,
            y: canvas.height - CONFIG.MONSTER_HEIGHT - 30,
            width: CONFIG.MONSTER_WIDTH,
            height: CONFIG.MONSTER_HEIGHT
        });
    }
    
    // Бонусы
    if (Math.random() < CONFIG.BONUS_SPAWN_CHANCE) {
        const bonusTypes = ['ice', 'fire', 'orange', 'pineapple', 'coal'];
        const type = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
        
        const minY = CONFIG.BONUS_MIN_HEIGHT;
        const maxY = Math.min(CONFIG.BONUS_MAX_HEIGHT, canvas.height - 100);
        const y = Math.random() * (maxY - minY) + minY;
        
        bonuses.push({
            x: canvas.width,
            y: y,
            width: CONFIG.BONUS_SIZE,
            height: CONFIG.BONUS_SIZE,
            type: type,
            value: getBonusValue(type)
        });
    }
}

function getBonusValue(type) {
    const values = { ice: 1, fire: 2, orange: 3, pineapple: 5, coal: 0 };
    return values[type] || 1;
}

function getBonusName(type) {
    const names = { 
        ice: 'ЛЁД', 
        fire: 'ОГОНЬ', 
        orange: 'АПЕЛ.', 
        pineapple: 'АНАН.', 
        coal: 'УГЛИ' 
    };
    return names[type] || '???';
}

function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function collectBonus(bonus) {
    totalBonusesCollected++;
    bonusStats[bonus.type]++;
    updateBonusCounters();
    
    // Увеличение скорости каждые 5 бонусов
    if (totalBonusesCollected % 5 === 0) {
        increaseSpeed();
    }
    
    // Очки
    if (bonus.type !== 'coal') {
        const points = bonus.value;
        score += points;
        document.getElementById('currentScore').textContent = score;
        
        // Эффект сбора
        showBonusEffect(bonus.x + bonus.width/2, bonus.y, `+${points}`);
    } else {
        showBonusEffect(bonus.x + bonus.width/2, bonus.y, 'x2');
    }
}

function increaseSpeed() {
    gameSpeed += CONFIG.SPEED_INCREASE_PER_5_BONUSES;
    background.speed = gameSpeed * 0.5;
    
    // Обновляем уровень скорости
    speedLevel = gameSpeed / CONFIG.BASE_SPEED * 2;
    updateSpeedDisplay();
    
    // Визуальный эффект
    showSpeedEffect();
}

function showBonusEffect(x, y, text) {
    const effect = {
        x: x,
        y: y,
        text: text,
        alpha: 1,
        velocityY: -1,
        size: 20
    };
    
    function animate() {
        ctx.save();
        ctx.globalAlpha = effect.alpha;
        ctx.fillStyle = text === 'x2' ? '#ffd700' : '#00ff88';
        ctx.font = `bold ${effect.size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(effect.text, effect.x, effect.y);
        ctx.restore();
        
        effect.y += effect.velocityY;
        effect.alpha -= 0.02;
        effect.size += 0.1;
        
        if (effect.alpha > 0) {
            requestAnimationFrame(animate);
        }
    }
    
    animate();
}

function showSpeedEffect() {
    const speedElement = document.getElementById('speedLevel');
    speedElement.classList.add('speed-up');
    setTimeout(() => {
        speedElement.classList.remove('speed-up');
    }, 600);
}

function updateBonusCounters() {
    document.getElementById('iceCount').textContent = bonusStats.ice;
    document.getElementById('fireCount').textContent = bonusStats.fire;
    document.getElementById('orangeCount').textContent = bonusStats.orange;
    document.getElementById('pineappleCount').textContent = bonusStats.pineapple;
    document.getElementById('coalCount').textContent = bonusStats.coal;
}

function updateSpeedDisplay() {
    document.getElementById('speedLevel').textContent = `x${speedLevel.toFixed(1)}`;
}

function endGame() {
    gameRunning = false;
    gameOver = true;
    
    // Новый рекорд
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('lunaHighScore', highScore);
        document.getElementById('highScore').textContent = highScore;
        document.getElementById('highScore').classList.add('new-record');
    }
    
    // Экран завершения
    document.getElementById('finalScore').textContent = score;
    setTimeout(() => {
        document.getElementById('gameOverScreen').style.display = 'flex';
    }, 500);
}

function restartGame() {
    startGame();
}

function renderStartScreen() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Градиентный фон
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#252542');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Заголовок
    ctx.fillStyle = '#ffd700';
    ctx.font = `bold ${Math.min(48, canvas.width / 10)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LUNA BAR', canvas.width / 2, canvas.height / 2 - 30);
    
    // Подсказка
    ctx.fillStyle = '#888';
    ctx.font = `${Math.min(20, canvas.width / 20)}px sans-serif`;
    ctx.fillText('Нажми СТАРТ', canvas.width / 2, canvas.height / 2 + 20);
}

// =================== ЗАПУСК ===================
window.onload = init;