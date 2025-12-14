// =================== КОНСТАНТЫ И НАСТРОЙКИ ===================
const CONFIG = {
    CANVAS_WIDTH: 850,
    CANVAS_HEIGHT: 450,
    GRAVITY: 0.8,
    JUMP_FORCE: -18,
    GAME_SPEED: 5,
    HERO_WIDTH: 128,     // Увеличен в 2 раза (было 64)
    HERO_HEIGHT: 128,    // Увеличен в 2 раза
    OBSTACLE_WIDTH: 60,
    OBSTACLE_HEIGHT: 60,
    BONUS_SIZE: 50,
    GROUND_HEIGHT: 60,
    SPAWN_INTERVAL: 1400,
    BONUS_SPAWN_CHANCE: 0.35,
    MONSTER_SPAWN_CHANCE: 0.5,
    BONUS_MAX_HEIGHT: 300,    // Доступная высота для бонусов
    BONUS_MIN_HEIGHT: 200,    // Минимальная высота
    DOUBLE_JUMP_ENABLED: true,
    DOUBLE_JUMP_FORCE: -16,
    SPEED_INCREASE_INTERVAL: 100, // Увеличиваем скорость каждые 100 очков
    MAX_SPEED: 12
};

// =================== ПЕРЕМЕННЫЕ ИГРЫ ===================
let canvas, ctx;
let gameRunning = false;
let gameOver = false;
let score = 0;
let highScore = localStorage.getItem('lunaHighScore') || 0;
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
    x: 180,
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
    speed: gameSpeed * 0.5,
    color1: '#1e1e2e',
    color2: '#252542'
};

let obstacles = [];
let bonuses = [];
let spawnTimer = 0;
let particles = [];

// =================== ИЗОБРАЖЕНИЯ ===================
const images = {};
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

// =================== СИСТЕМА ЧАСТИЦ ===================
class Particle {
    constructor(x, y, color, velocityX, velocityY, size, life) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.velocityX = velocityX;
        this.velocityY = velocityY;
        this.size = size;
        this.life = life;
        this.maxLife = life;
    }
    
    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.life--;
        this.velocityY += 0.1; // Гравитация
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

// =================== ИНИЦИАЛИЗАЦИЯ ===================
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Установка высокого счета
    document.getElementById('highScore').textContent = highScore;
    updateBonusCounters();
    updateMultiplierDisplay();
    
    // Загрузка изображений
    loadImages();
    
    // Обработчики событий
    setupEventListeners();
    
    // Начальный рендер
    renderStartScreen();
}

function loadImages() {
    let loadedCount = 0;
    const totalImages = Object.keys(imageSources).length;
    
    Object.keys(imageSources).forEach(key => {
        images[key] = new Image();
        images[key].src = imageSources[key];
        images[key].onload = () => {
            loadedCount++;
            if (loadedCount === totalImages) {
                console.log('✅ Все изображения загружены');
            }
        };
        images[key].onerror = () => {
            console.error(`❌ Ошибка загрузки: ${imageSources[key]}`);
            // Заглушка при ошибке
            images[key] = createPlaceholder(50, 50, key === 'hero' ? '#ffd700' : '#666');
        };
    });
}

function createPlaceholder(width, height, color) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(0, 0, width, height);
    const img = new Image();
    img.src = canvas.toDataURL();
    return img;
}

function setupEventListeners() {
    canvas.addEventListener('click', handleJump);
    
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            handleJump();
            e.preventDefault();
        }
        if (e.code === 'Enter' && !gameRunning) {
            startGame();
        }
    });
    
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('restartBtn').addEventListener('click', restartGame);
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
    particles = [];
    
    // Сброс статистики
    bonusStats = { ice: 0, fire: 0, orange: 0, pineapple: 0, coal: 0 };
    updateBonusCounters();
    updateMultiplierDisplay();
    updateFinalStats();
    
    // Сброс героя
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
    
    // Запуск игрового цикла
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
        spawnTimer -= 16;
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
    
    // Гравитация и движение
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
        
        // Эффект приземления
        if (Math.abs(hero.velocityY) > 5) {
            createLandingEffect();
        }
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
        
        if (checkCollision(hero, obstacles[i])) {
            endGame();
            return;
        }
        
        if (obstacles[i].x < -CONFIG.OBSTACLE_WIDTH) {
            obstacles.splice(i, 1);
        }
    }
    
    // Обновить бонусы
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
    
    // Обновить частицы
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
    
    // Увеличение скорости
    if (score > 0 && score % CONFIG.SPEED_INCREASE_INTERVAL === 0) {
        gameSpeed = Math.min(CONFIG.MAX_SPEED, CONFIG.GAME_SPEED + Math.floor(score / CONFIG.SPEED_INCREASE_INTERVAL));
        background.speed = gameSpeed * 0.5;
    }
}

function render() {
    // Очистить канвас
    ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    
    // Градиентный фон
    const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.CANVAS_HEIGHT);
    gradient.addColorStop(0, background.color1);
    gradient.addColorStop(1, background.color2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    
    // Фоновое изображение
    if (images.background && images.background.complete) {
        ctx.drawImage(images.background, background.x1, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        ctx.drawImage(images.background, background.x2, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    }
    
    // Земля
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_HEIGHT, CONFIG.CANVAS_WIDTH, CONFIG.GROUND_HEIGHT);
    
    // Тень под героем
    if (!hero.isOnGround) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(
            hero.x + hero.width/2,
            CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_HEIGHT,
            hero.width/3,
            hero.height/8,
            0, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
    }
    
    // Частицы
    particles.forEach(particle => particle.draw(ctx));
    
    // Бонусы (с анимацией)
    bonuses.forEach(bonus => {
        if (bonus.img && bonus.img.complete) {
            const pulse = Math.sin(Date.now() * 0.006) * 4;
            const rotation = Math.sin(Date.now() * 0.003) * 0.1;
            
            ctx.save();
            ctx.translate(bonus.x + CONFIG.BONUS_SIZE/2, bonus.y + CONFIG.BONUS_SIZE/2);
            ctx.rotate(rotation);
            ctx.drawImage(bonus.img, 
                -CONFIG.BONUS_SIZE/2 - pulse/2, 
                -CONFIG.BONUS_SIZE/2 - pulse/2, 
                CONFIG.BONUS_SIZE + pulse, 
                CONFIG.BONUS_SIZE + pulse
            );
            ctx.restore();
        }
    });
    
    // Препятствия
    obstacles.forEach(obstacle => {
        if (obstacle.img && obstacle.img.complete) {
            ctx.drawImage(obstacle.img, obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        }
    });
    
    // Герой
    if (images.hero && images.hero.complete) {
        ctx.drawImage(images.hero, hero.x, hero.y, hero.width, hero.height);
    }
    
    // Эффект множителя
    if (multiplier > 1) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`×${multiplier}`, CONFIG.CANVAS_WIDTH - 20, 40);
        ctx.restore();
    }
}

// =================== ИГРОВЫЕ МЕХАНИКИ ===================
function handleJump() {
    if (!gameRunning || gameOver) return;
    
    const now = Date.now();
    
    if (hero.isOnGround) {
        // Первый прыжок
        hero.velocityY = CONFIG.JUMP_FORCE;
        hero.isJumping = true;
        hero.isOnGround = false;
        hero.jumpCount = 1;
        hero.canDoubleJump = true;
        createJumpEffect('#ffd700', 12);
    } 
    else if (CONFIG.DOUBLE_JUMP_ENABLED && hero.canDoubleJump && hero.jumpCount < 2) {
        // Второй прыжок
        hero.velocityY = CONFIG.DOUBLE_JUMP_FORCE;
        hero.jumpCount = 2;
        hero.canDoubleJump = false;
        createJumpEffect('#ff6b6b', 15);
    }
}

function createJumpEffect(color, count) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(
            hero.x + hero.width/2 + Math.random() * 20 - 10,
            hero.y + hero.height,
            color,
            Math.random() * 4 - 2,
            -Math.random() * 3 - 2,
            Math.random() * 4 + 2,
            Math.random() * 30 + 30
        ));
    }
}

function createLandingEffect() {
    for (let i = 0; i < 8; i++) {
        particles.push(new Particle(
            hero.x + hero.width/2 + Math.random() * 40 - 20,
            CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_HEIGHT,
            '#666',
            Math.random() * 6 - 3,
            -Math.random() * 2 - 1,
            Math.random() * 3 + 2,
            Math.random() * 40 + 20
        ));
    }
}

function spawnObjects() {
    // Монстры
    if (Math.random() < CONFIG.MONSTER_SPAWN_CHANCE) {
        const monsterType = Math.floor(Math.random() * 3) + 1;
        let monsterImg;
        
        switch(monsterType) {
            case 1: monsterImg = images.mon1; break;
            case 2: monsterImg = images.mon2; break;
            case 3: monsterImg = images.mon3; break;
        }
        
        obstacles.push({
            img: monsterImg,
            x: CONFIG.CANVAS_WIDTH,
            y: CONFIG.CANVAS_HEIGHT - CONFIG.OBSTACLE_HEIGHT - CONFIG.GROUND_HEIGHT,
            width: CONFIG.OBSTACLE_WIDTH,
            height: CONFIG.OBSTACLE_HEIGHT
        });
    }
    
    // Бонусы (только на доступной высоте!)
    if (Math.random() < CONFIG.BONUS_SPAWN_CHANCE) {
        const bonusTypes = [
            { img: images.ice, value: 1, type: 'ice' },
            { img: images.fire, value: 2, type: 'fire' },
            { img: images.orange, value: 3, type: 'orange' },
            { img: images.pineapple, value: 5, type: 'pineapple' },
            { img: images.coal, value: 0, type: 'coal' }
        ];
        
        const bonus = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
        
        // Высота в пределах досягаемости
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
    // Уменьшаем hitbox для более честной игры
    const padding = 10;
    return rect1.x + padding < rect2.x + rect2.width - padding &&
           rect1.x + rect1.width - padding > rect2.x + padding &&
           rect1.y + padding < rect2.y + rect2.height - padding &&
           rect1.y + rect1.height - padding > rect2.y + padding;
}

function collectBonus(bonus) {
    let points = bonus.value;
    
    // Статистика
    bonusStats[bonus.type]++;
    updateBonusCounters();
    
    // Эффект сбора
    createCollectEffect(bonus.x + CONFIG.BONUS_SIZE/2, bonus.y + CONFIG.BONUS_SIZE/2, bonus.type);
    
    if (bonus.type === 'coal') {
        multiplier = 2;
        multiplierTimer = 10000;
        points = 0;
        updateMultiplierDisplay();
    } else {
        points *= multiplier;
        score += points;
    }
    
    // Обновить счёт
    document.getElementById('currentScore').textContent = score;
    
    // Визуальный эффект
    showScoreEffect(bonus.x + CONFIG.BONUS_SIZE/2, bonus.y, points > 0 ? `+${points}` : '×2');
}

function createCollectEffect(x, y, type) {
    const colors = {
        ice: '#00ffff',
        fire: '#ff6b6b',
        orange: '#ffa500',
        pineapple: '#ffd700',
        coal: '#666666'
    };
    
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(
            x,
            y,
            colors[type] || '#ffffff',
            Math.random() * 8 - 4,
            Math.random() * 8 - 4,
            Math.random() * 4 + 2,
            Math.random() * 40 + 20
        ));
    }
}

function showScoreEffect(x, y, text) {
    const effect = {
        x: x,
        y: y,
        text: text,
        alpha: 1,
        velocityY: -1.5,
        size: 24
    };
    
    function animate() {
        ctx.save();
        ctx.globalAlpha = effect.alpha;
        ctx.fillStyle = text === '×2' ? '#ffd700' : '#ffffff';
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

function updateBonusCounters() {
    document.getElementById('iceCount').textContent = bonusStats.ice;
    document.getElementById('fireCount').textContent = bonusStats.fire;
    document.getElementById('orangeCount').textContent = bonusStats.orange;
    document.getElementById('pineappleCount').textContent = bonusStats.pineapple;
    document.getElementById('coalCount').textContent = bonusStats.coal;
}

function updateFinalStats() {
    document.getElementById('iceFinal').textContent = bonusStats.ice;
    document.getElementById('fireFinal').textContent = bonusStats.fire;
    document.getElementById('orangeFinal').textContent = bonusStats.orange;
    document.getElementById('pineappleFinal').textContent = bonusStats.pineapple;
    document.getElementById('coalFinal').textContent = bonusStats.coal;
}

function updateMultiplierDisplay() {
    const multiplierText = document.getElementById('multiplierValue');
    const multiplierFill = document.getElementById('multiplierFill');
    
    multiplierText.textContent = `×${multiplier}`;
    multiplierText.style.color = multiplier > 1 ? '#06d6a0' : '#ffd700';
    
    if (multiplier > 1) {
        const percent = (multiplierTimer / 10000) * 100;
        multiplierFill.style.width = `${percent}%`;
        
        // Меняем цвет при заканчивающемся времени
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

function endGame() {
    gameRunning = false;
    gameOver = true;
    
    // Эффект проигрыша
    for (let i = 0; i < 30; i++) {
        particles.push(new Particle(
            hero.x + hero.width/2,
            hero.y + hero.height/2,
            '#ff6b6b',
            Math.random() * 10 - 5,
            Math.random() * 10 - 5,
            Math.random() * 5 + 3,
            Math.random() * 60 + 30
        ));
    }
    
    // Обновить рекорд
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('lunaHighScore', highScore);
        document.getElementById('highScore').textContent = highScore;
        document.getElementById('highScore').classList.add('new-record');
    }
    
    // Показать итоги
    document.getElementById('finalScore').textContent = score;
    updateFinalStats();
    
    // Показать экран проигрыша
    setTimeout(() => {
        document.getElementById('gameOverScreen').style.display = 'flex';
    }, 800);
}

function restartGame() {
    startGame();
}

function renderStartScreen() {
    ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    
    // Градиентный фон
    const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.CANVAS_HEIGHT);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#252542');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    
    // Заголовок
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LUNA BAR', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 50);
    
    // Подзаголовок
    ctx.fillStyle = '#b0b0b0';
    ctx.font = '20px sans-serif';
    ctx.fillText('Жди заказ • Собирай бонусы', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 10);
}

// =================== ЗАПУСК ===================
window.onload = init;