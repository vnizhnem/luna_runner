// =================== КОНСТАНТЫ И НАСТРОЙКИ ===================
const CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 500,
    GRAVITY: 0.8,
    JUMP_FORCE: -16,
    GAME_SPEED: 5,
    HERO_WIDTH: 96,  // Увеличен в 1.5 раза
    HERO_HEIGHT: 96,
    OBSTACLE_WIDTH: 50,
    OBSTACLE_HEIGHT: 50,
    BONUS_SIZE: 50,
    GROUND_HEIGHT: 50,
    SPAWN_INTERVAL: 1500,
    BONUS_SPAWN_CHANCE: 0.3,
    MONSTER_SPAWN_CHANCE: 0.6,
    BONUS_MAX_HEIGHT: 350,  // Максимальная высота бонусов
    DOUBLE_JUMP_ENABLED: true,
    DOUBLE_JUMP_FORCE: -14,
    BONUS_MIN_HEIGHT: 180   // Минимальная высота бонусов
};

// =================== ПЕРЕМЕННЫЕ ИГРЫ ===================
let canvas, ctx;
let gameRunning = false;
let gameOver = false;
let score = 0;
let highScore = localStorage.getItem('barRunnerHighScore') || 0;
let gameSpeed = CONFIG.GAME_SPEED;
let multiplier = 1;
let multiplierTimer = 0;

// Статистика бонусов
let bonusStats = {
    ice: 0,
    fire: 0,
    orange: 0,
    pineapple: 0,
    coal: 0
};

// =================== ОБЪЕКТЫ ИГРЫ ===================
const hero = {
    x: 150,
    y: CONFIG.CANVAS_HEIGHT - CONFIG.HERO_HEIGHT - CONFIG.GROUND_HEIGHT,
    width: CONFIG.HERO_WIDTH,
    height: CONFIG.HERO_HEIGHT,
    velocityY: 0,
    isJumping: false,
    isOnGround: true,
    canDoubleJump: false,
    jumpCount: 0,
    lastJumpTime: 0
};

const background = {
    x1: 0,
    x2: CONFIG.CANVAS_WIDTH,
    speed: gameSpeed * 0.5
};

let obstacles = [];
let bonuses = [];
let spawnTimer = 0;

// =================== ИЗОБРАЖЕНИЯ ===================
const images = {
    hero: new Image(),
    background: new Image(),
    mon1: new Image(),
    mon2: new Image(),
    mon3: new Image(),
    ice: new Image(),
    fire: new Image(),
    orange: new Image(),
    pineapple: new Image(),
    coal: new Image()
};

// Загрузка изображений
const imageSources = {
    hero: 'assets/hero.png',
    background: 'assets/background.png',
    mon1: 'assets/mon1.png',
    mon2: 'assets/mon2.png',
    mon3: 'assets/mon3.png',
    ice: 'assets/ice.png',
    fire: 'assets/fire.png',
    orange: 'assets/orange.png',
    pineapple: 'assets/pineapple.png',
    coal: 'assets/coal.png'
};

// Загружаем все изображения
let imagesLoaded = 0;
const totalImages = Object.keys(imageSources).length;

Object.keys(imageSources).forEach(key => {
    images[key].src = imageSources[key];
    images[key].onload = () => {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            console.log('Все изображения загружены!');
        }
    };
    images[key].onerror = () => {
        console.error(`Ошибка загрузки: ${imageSources[key]}`);
    };
});

// =================== ИНИЦИАЛИЗАЦИЯ ===================
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Установка высокого счета
    document.getElementById('highScore').textContent = highScore;
    updateBonusCounters();
    
    // Обработчики событий
    canvas.addEventListener('click', handleJump);
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            handleJump();
        }
        if (e.code === 'Enter' && !gameRunning) {
            startGame();
        }
    });
    
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('restartBtn').addEventListener('click', restartGame);
    
    // Начальный рендер
    renderStartScreen();
}

// =================== ИГРОВАЯ ЛОГИКА ===================
function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    
    gameRunning = true;
    gameOver = false;
    score = 0;
    gameSpeed = CONFIG.GAME_SPEED;
    multiplier = 1;
    multiplierTimer = 0;
    
    // Сброс статистики бонусов
    bonusStats = { ice: 0, fire: 0, orange: 0, pineapple: 0, coal: 0 };
    updateBonusCounters();
    updateMultiplierDisplay();
    
    // Сброс позиций
    hero.y = CONFIG.CANVAS_HEIGHT - CONFIG.HERO_HEIGHT - CONFIG.GROUND_HEIGHT;
    hero.velocityY = 0;
    hero.isJumping = false;
    hero.isOnGround = true;
    hero.canDoubleJump = false;
    hero.jumpCount = 0;
    
    obstacles = [];
    bonuses = [];
    spawnTimer = 0;
    
    // Обновить интерфейс
    document.getElementById('currentScore').textContent = score;
    
    // Запустить игровой цикл
    requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    if (!gameRunning) return;
    
    update(timestamp);
    render();
    
    requestAnimationFrame(gameLoop);
}

function update(timestamp) {
    // Обновить таймеры
    if (spawnTimer <= 0) {
        spawnObjects();
        spawnTimer = CONFIG.SPAWN_INTERVAL;
    } else {
        spawnTimer -= 16; // примерно 60 FPS
    }
    
    // Обновить множитель
    if (multiplierTimer > 0) {
        multiplierTimer -= 16;
        updateMultiplierDisplay();
        if (multiplierTimer <= 0) {
            multiplier = 1;
            updateMultiplierDisplay();
        }
    }
    
    // Гравитация и движение героя
    hero.velocityY += CONFIG.GRAVITY;
    hero.y += hero.velocityY;
    
    // Проверка земли
    const groundY = CONFIG.CANVAS_HEIGHT - CONFIG.HERO_HEIGHT - CONFIG.GROUND_HEIGHT;
    if (hero.y > groundY) {
        hero.y = groundY;
        hero.velocityY = 0;
        hero.isJumping = false;
        hero.isOnGround = true;
        hero.jumpCount = 0;
        hero.canDoubleJump = false;
    }
    
    // Движение фона
    background.x1 -= background.speed;
    background.x2 -= background.speed;
    
    if (background.x1 <= -CONFIG.CANVAS_WIDTH) {
        background.x1 = CONFIG.CANVAS_WIDTH;
    }
    if (background.x2 <= -CONFIG.CANVAS_WIDTH) {
        background.x2 = CONFIG.CANVAS_WIDTH;
    }
    
    // Обновить препятствия
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= gameSpeed;
        
        // Проверка столкновения
        if (checkCollision(hero, obstacles[i])) {
            endGame();
            return;
        }
        
        // Удалить если за экраном
        if (obstacles[i].x < -CONFIG.OBSTACLE_WIDTH) {
            obstacles.splice(i, 1);
        }
    }
    
    // Обновить бонусы
    for (let i = bonuses.length - 1; i >= 0; i--) {
        bonuses[i].x -= gameSpeed;
        
        // Проверка сбора
        if (checkCollision(hero, bonuses[i])) {
            collectBonus(bonuses[i]);
            bonuses.splice(i, 1);
        }
        
        // Удалить если за экраном
        else if (bonuses[i].x < -CONFIG.BONUS_SIZE) {
            bonuses.splice(i, 1);
        }
    }
    
    // Увеличивать скорость со временем
    if (score > 0 && score % 100 === 0) {
        gameSpeed = CONFIG.GAME_SPEED + Math.floor(score / 100);
        background.speed = gameSpeed * 0.5;
    }
}

function render() {
    // Очистить канвас
    ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    
    // Нарисовать фон
    ctx.drawImage(images.background, background.x1, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    ctx.drawImage(images.background, background.x2, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    
    // Нарисовать землю
    ctx.fillStyle = '#533483';
    ctx.fillRect(0, CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_HEIGHT, CONFIG.CANVAS_WIDTH, CONFIG.GROUND_HEIGHT);
    ctx.fillStyle = '#6a4c93';
    ctx.fillRect(0, CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_HEIGHT, CONFIG.CANVAS_WIDTH, 10);
    
    // Нарисовать героя
    ctx.drawImage(images.hero, hero.x, hero.y, hero.width, hero.height);
    
    // Нарисовать препятствия
    obstacles.forEach(obstacle => {
        ctx.drawImage(obstacle.img, obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    });
    
    // Нарисовать бонусы
    bonuses.forEach(bonus => {
        // Анимация пульсации для бонусов
        const pulse = Math.sin(Date.now() * 0.005) * 3;
        const size = CONFIG.BONUS_SIZE + pulse;
        const offset = (CONFIG.BONUS_SIZE - size) / 2;
        
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.drawImage(bonus.img, 
            bonus.x + offset, 
            bonus.y + offset, 
            size, 
            size);
        ctx.restore();
    });
}

// =================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===================
function handleJump() {
    if (!gameRunning || gameOver) return;
    
    const now = Date.now();
    
    if (hero.isOnGround) {
        // Первый прыжок с земли
        hero.velocityY = CONFIG.JUMP_FORCE;
        hero.isJumping = true;
        hero.isOnGround = false;
        hero.jumpCount = 1;
        hero.canDoubleJump = true;
        hero.lastJumpTime = now;
        createJumpEffect('#00ffff');
    } 
    else if (CONFIG.DOUBLE_JUMP_ENABLED && hero.canDoubleJump && hero.jumpCount < 2) {
        // Второй прыжок в воздухе
        hero.velocityY = CONFIG.DOUBLE_JUMP_FORCE;
        hero.jumpCount = 2;
        hero.canDoubleJump = false;
        createJumpEffect('#ff6b6b');
    }
}

function createJumpEffect(color) {
    const particles = 6;
    for (let i = 0; i < particles; i++) {
        setTimeout(() => {
            ctx.fillStyle = color;
            ctx.fillRect(
                hero.x + hero.width/2 - 2 + (Math.random() * 8 - 4),
                hero.y + hero.height - 2,
                4, 
                4
            );
        }, i * 30);
    }
}

function spawnObjects() {
    // Шанс спавна монстра
    if (Math.random() < CONFIG.MONSTER_SPAWN_CHANCE) {
        const monsterType = Math.floor(Math.random() * 3) + 1;
        let monsterImg;
        
        switch(monsterType) {
            case 1: monsterImg = images.mon1; break;
            case 2: monsterImg = images.mon2; break;
            case 3: monsterImg = images.mon3; break;
        }
        
        const obstacle = {
            img: monsterImg,
            x: CONFIG.CANVAS_WIDTH,
            y: CONFIG.CANVAS_HEIGHT - CONFIG.OBSTACLE_HEIGHT - CONFIG.GROUND_HEIGHT,
            width: CONFIG.OBSTACLE_WIDTH,
            height: CONFIG.OBSTACLE_HEIGHT
        };
        
        obstacles.push(obstacle);
    }
    
    // Шанс спавна бонуса (ограниченная высота!)
    if (Math.random() < CONFIG.BONUS_SPAWN_CHANCE) {
        const bonusTypes = [
            { img: images.ice, value: 1, type: 'ice' },
            { img: images.fire, value: 2, type: 'fire' },
            { img: images.orange, value: 3, type: 'orange' },
            { img: images.pineapple, value: 5, type: 'pineapple' },
            { img: images.coal, value: 0, type: 'coal' }
        ];
        
        const bonus = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
        
        // ОГРАНИЧЕННАЯ ВЫСОТА БОНУСОВ!
        const minY = CONFIG.BONUS_MIN_HEIGHT;
        const maxY = CONFIG.BONUS_MAX_HEIGHT;
        const randomY = Math.random() * (maxY - minY) + minY;
        
        bonuses.push({
            img: bonus.img,
            x: CONFIG.CANVAS_WIDTH,
            y: randomY,
            width: CONFIG.BONUS_SIZE,
            height: CONFIG.BONUS_SIZE,
            value: bonus.value,
            type: bonus.type
        });
    }
}

function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function collectBonus(bonus) {
    let points = bonus.value;
    
    // Обновляем статистику
    bonusStats[bonus.type]++;
    updateBonusCounters();
    
    if (bonus.type === 'coal') {
        multiplier = 2;
        multiplierTimer = 10000; // 10 секунд
        points = 0;
        updateMultiplierDisplay();
    } else {
        points *= multiplier;
        score += points;
    }
    
    // Обновить интерфейс
    document.getElementById('currentScore').textContent = score;
    
    // Визуальный эффект сбора
    createBonusEffect(bonus.x, bonus.y, points > 0 ? `+${points}` : 'x2!');
}

function updateBonusCounters() {
    document.getElementById('iceCount').textContent = bonusStats.ice;
    document.getElementById('fireCount').textContent = bonusStats.fire;
    document.getElementById('orangeCount').textContent = bonusStats.orange;
    document.getElementById('pineappleCount').textContent = bonusStats.pineapple;
    document.getElementById('coalCount').textContent = bonusStats.coal;
}

function updateMultiplierDisplay() {
    const multiplierText = document.getElementById('multiplierText');
    const multiplierFill = document.getElementById('multiplierFill');
    
    multiplierText.textContent = `Множитель: x${multiplier}`;
    
    if (multiplier > 1) {
        const percent = (multiplierTimer / 10000) * 100;
        multiplierFill.style.width = `${percent}%`;
        
        if (multiplierTimer < 3000) {
            multiplierFill.style.background = 'linear-gradient(to right, #ef476f, #ff6b6b)';
        } else {
            multiplierFill.style.background = 'linear-gradient(to right, #06d6a0, #ffd166)';
        }
    } else {
        multiplierFill.style.width = '100%';
        multiplierFill.style.background = 'linear-gradient(to right, #06d6a0, #ffd166)';
    }
}

function createBonusEffect(x, y, text) {
    const effect = {
        x: x + 25,
        y: y,
        text: text,
        alpha: 1,
        velocityY: -2,
        size: 24
    };
    
    function animate() {
        ctx.save();
        ctx.globalAlpha = effect.alpha;
        ctx.fillStyle = effect.text === 'x2!' ? '#ffd166' : '#00ffff';
        ctx.font = `bold ${effect.size}px Courier New`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(effect.text, effect.x, effect.y);
        ctx.restore();
        
        effect.y += effect.velocityY;
        effect.alpha -= 0.02;
        effect.size += 0.2;
        
        if (effect.alpha > 0) {
            requestAnimationFrame(animate);
        }
    }
    
    animate();
}

function endGame() {
    gameRunning = false;
    gameOver = true;
    
    // Обновить рекорд
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('barRunnerHighScore', highScore);
        document.getElementById('highScore').textContent = highScore;
        document.getElementById('highScore').classList.add('new-record');
    }
    
    // Показать экран проигрыша
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOverScreen').style.display = 'block';
}

function restartGame() {
    startGame();
}

function renderStartScreen() {
    // Просто очищаем и показываем стартовый экран
    ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    
    // Фон для стартового экрана
    ctx.fillStyle = '#0f3460';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    
    // Надпись
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 36px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('BAR RUNNER', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 50);
    
    ctx.fillStyle = '#8ac6d1';
    ctx.font = '20px Courier New';
    ctx.fillText('Жди заказ — собирай бонусы!', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2);
}

// =================== ЗАПУСК ИГРЫ ===================
window.onload = init;