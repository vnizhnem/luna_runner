// =================== НАСТРОЙКИ ИГРЫ ===================
const CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,       // Высота твоего фона
    GRAVITY: 0.8,
    JUMP_FORCE: -18,
    BASE_SPEED: 5,
    HERO_WIDTH: 128,          // Увеличенный герой
    HERO_HEIGHT: 128,
    MONSTER_WIDTH: 60,        // Только mon3.png
    MONSTER_HEIGHT: 60,
    BONUS_SIZE: 50,
    SPAWN_INTERVAL: 1500,
    BONUS_SPAWN_CHANCE: 0.4,
    MONSTER_SPAWN_CHANCE: 0.6,
    BONUS_MAX_HEIGHT: 450,    // Доступная высота для прыжка
    BONUS_MIN_HEIGHT: 250,
    DOUBLE_JUMP_ENABLED: true,
    DOUBLE_JUMP_FORCE: -16,
    SPEED_INCREASE_PER_5_BONUSES: 0.5, // +0.5 скорости за каждые 5 бонусов
    MAX_SPEED: 10
};

// =================== ПЕРЕМЕННЫЕ ===================
let canvas, ctx;
let gameRunning = false;
let gameOver = false;
let score = 0;
let highScore = localStorage.getItem('lunaHighScore') || 0;
let gameSpeed = CONFIG.BASE_SPEED;
let totalBonusesCollected = 0;
let speedLevel = 1.0;

// Статистика бонусов
let bonusStats = {
    ice: 0,
    fire: 0,
    orange: 0,
    pineapple: 0,
    coal: 0
};

// =================== ОБЪЕКТЫ ===================
const hero = {
    x: 150,
    y: CONFIG.CANVAS_HEIGHT - CONFIG.HERO_HEIGHT - 50, // 50px от нижнего края
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
    x2: CONFIG.CANVAS_WIDTH,
    speed: CONFIG.BASE_SPEED * 0.5
};

let monsters = [];
let bonuses = [];
let spawnTimer = 0;

// =================== ЗАГРУЗКА ИЗОБРАЖЕНИЙ ===================
const images = {};

function loadImages() {
    return new Promise((resolve) => {
        const imageList = [
            { key: 'hero', src: 'assets/hero.png' },
            { key: 'background', src: 'assets/background.png' },
            { key: 'monster', src: 'assets/mon3.png' }, // Только один тип монстра
            { key: 'ice', src: 'assets/ice.png' },
            { key: 'fire', src: 'assets/fire.png' },
            { key: 'orange', src: 'assets/orange.png' },
            { key: 'pineapple', src: 'assets/pineapple.png' },
            { key: 'coal', src: 'assets/coal.png' }
        ];
        
        let loaded = 0;
        
        imageList.forEach(item => {
            images[item.key] = new Image();
            images[item.key].src = item.src;
            images[item.key].onload = () => {
                loaded++;
                if (loaded === imageList.length) {
                    console.log('✅ Все изображения загружены');
                    resolve();
                }
            };
            images[item.key].onerror = () => {
                console.error(`❌ Ошибка загрузки: ${item.src}`);
                // Создаём заглушку
                createPlaceholder(item.key);
                loaded++;
                if (loaded === imageList.length) resolve();
            };
        });
    });
}

function createPlaceholder(key) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (key === 'hero') {
        canvas.width = CONFIG.HERO_WIDTH;
        canvas.height = CONFIG.HERO_HEIGHT;
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(0, 0, CONFIG.HERO_WIDTH, CONFIG.HERO_HEIGHT);
        ctx.fillStyle = '#000';
        ctx.font = '20px Arial';
        ctx.fillText('HERO', 10, 40);
    } else if (key === 'monster') {
        canvas.width = CONFIG.MONSTER_WIDTH;
        canvas.height = CONFIG.MONSTER_HEIGHT;
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(0, 0, CONFIG.MONSTER_WIDTH, CONFIG.MONSTER_HEIGHT);
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.fillText('MON', 10, 25);
    } else {
        canvas.width = CONFIG.BONUS_SIZE;
        canvas.height = CONFIG.BONUS_SIZE;
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(0, 0, CONFIG.BONUS_SIZE, CONFIG.BONUS_SIZE);
    }
    
    images[key] = new Image();
    images[key].src = canvas.toDataURL();
}

// =================== ИНИЦИАЛИЗАЦИЯ ===================
async function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Загрузка изображений
    await loadImages();
    
    // Установка рекорда
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('speedLevel').textContent = `x${speedLevel.toFixed(1)}`;
    updateBonusCounters();
    
    // Обработчики событий
    canvas.addEventListener('click', handleJump);
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleJump();
    });
    
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
    
    // Начальный экран
    renderStartScreen();
}

// =================== ИГРОВАЯ ЛОГИКА ===================
function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    
    gameRunning = true;
    gameOver = false;
    score = 0;
    gameSpeed = CONFIG.BASE_SPEED;
    speedLevel = 1.0;
    totalBonusesCollected = 0;
    
    // Сброс статистики
    bonusStats = { ice: 0, fire: 0, orange: 0, pineapple: 0, coal: 0 };
    updateBonusCounters();
    updateSpeedDisplay();
    
    // Сброс позиций
    hero.y = CONFIG.CANVAS_HEIGHT - CONFIG.HERO_HEIGHT - 50;
    hero.velocityY = 0;
    hero.isJumping = false;
    hero.isOnGround = true;
    hero.canDoubleJump = false;
    hero.jumpCount = 0;
    
    monsters = [];
    bonuses = [];
    spawnTimer = 0;
    
    // Обновить интерфейс
    document.getElementById('currentScore').textContent = score;
    
    // Игровой цикл
    requestAnimationFrame(gameLoop);
}

function gameLoop() {
    if (!gameRunning) return;
    
    update();
    render();
    
    requestAnimationFrame(gameLoop);
}

function update() {
    // Спавн объектов
    if (spawnTimer <= 0) {
        spawnObjects();
        spawnTimer = CONFIG.SPAWN_INTERVAL;
    } else {
        spawnTimer -= 1000 / 60; // 60 FPS
    }
    
    // Физика героя
    hero.velocityY += CONFIG.GRAVITY;
    hero.y += hero.velocityY;
    
    // Проверка нижней границы
    const groundLevel = CONFIG.CANVAS_HEIGHT - CONFIG.HERO_HEIGHT - 50;
    if (hero.y > groundLevel) {
        hero.y = groundLevel;
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
    
    // Обновление монстров
    for (let i = monsters.length - 1; i >= 0; i--) {
        monsters[i].x -= gameSpeed;
        
        // Столкновение
        if (checkCollision(hero, monsters[i])) {
            endGame();
            return;
        }
        
        // Удаление за экраном
        if (monsters[i].x < -CONFIG.MONSTER_WIDTH) {
            monsters.splice(i, 1);
        }
    }
    
    // Обновление бонусов
    for (let i = bonuses.length - 1; i >= 0; i--) {
        bonuses[i].x -= gameSpeed;
        
        // Сбор бонуса
        if (checkCollision(hero, bonuses[i])) {
            collectBonus(bonuses[i]);
            bonuses.splice(i, 1);
        }
        // Удаление за экраном
        else if (bonuses[i].x < -CONFIG.BONUS_SIZE) {
            bonuses.splice(i, 1);
        }
    }
}

function render() {
    // Очистка
    ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    
    // Фон (растягиваем на весь экран)
    if (images.background && images.background.complete) {
        // Рисуем два изображения для бесконечного скролла
        ctx.drawImage(images.background, 
            background.x1, 0, 
            CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        ctx.drawImage(images.background, 
            background.x2, 0, 
            CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    } else {
        // Запасной фон
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    }
    
    // Бонусы (с анимацией)
    bonuses.forEach(bonus => {
        if (images[bonus.type] && images[bonus.type].complete) {
            // Пульсация
            const pulse = Math.sin(Date.now() * 0.005) * 3;
            const size = CONFIG.BONUS_SIZE + pulse;
            const offset = (CONFIG.BONUS_SIZE - size) / 2;
            
            ctx.save();
            ctx.globalAlpha = 0.9;
            ctx.drawImage(images[bonus.type], 
                bonus.x + offset, 
                bonus.y + offset, 
                size, size);
            ctx.restore();
        }
    });
    
    // Монстры
    monsters.forEach(monster => {
        if (images.monster && images.monster.complete) {
            ctx.drawImage(images.monster, 
                monster.x, monster.y, 
                monster.width, monster.height);
        }
    });
    
    // Герой
    if (images.hero && images.hero.complete) {
        ctx.drawImage(images.hero, 
            hero.x, hero.y, 
            hero.width, hero.height);
    }
    
    // Индикатор скорости
    if (speedLevel > 1.0) {
        ctx.save();
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`Скорость: x${speedLevel.toFixed(1)}`, CONFIG.CANVAS_WIDTH - 20, 30);
        ctx.restore();
    }
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
            x: CONFIG.CANVAS_WIDTH,
            y: CONFIG.CANVAS_HEIGHT - CONFIG.MONSTER_HEIGHT - 50,
            width: CONFIG.MONSTER_WIDTH,
            height: CONFIG.MONSTER_HEIGHT
        });
    }
    
    // Бонусы
    if (Math.random() < CONFIG.BONUS_SPAWN_CHANCE) {
        const bonusTypes = ['ice', 'fire', 'orange', 'pineapple', 'coal'];
        const type = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
        
        // Высота в пределах досягаемости
        const minY = CONFIG.BONUS_MIN_HEIGHT;
        const maxY = CONFIG.BONUS_MAX_HEIGHT;
        const y = Math.random() * (maxY - minY) + minY;
        
        bonuses.push({
            x: CONFIG.CANVAS_WIDTH,
            y: y,
            width: CONFIG.BONUS_SIZE,
            height: CONFIG.BONUS_SIZE,
            type: type,
            value: getBonusValue(type)
        });
    }
}

function getBonusValue(type) {
    switch(type) {
        case 'ice': return 1;
        case 'fire': return 2;
        case 'orange': return 3;
        case 'pineapple': return 5;
        case 'coal': return 0;
        default: return 1;
    }
}

function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function collectBonus(bonus) {
    // Увеличиваем счётчик бонусов
    totalBonusesCollected++;
    
    // Обновляем статистику
    bonusStats[bonus.type]++;
    updateBonusCounters();
    
    // Увеличиваем скорость каждые 5 бонусов
    if (totalBonusesCollected % 5 === 0) {
        increaseSpeed();
    }
    
    // Добавляем очки
    if (bonus.type !== 'coal') {
        const points = bonus.value;
        score += points;
        document.getElementById('currentScore').textContent = score;
        
        // Эффект сбора
        showBonusEffect(bonus.x, bonus.y, `+${points}`);
    } else {
        // Угли дают х2 на 10 секунд (если хочешь)
        showBonusEffect(bonus.x, bonus.y, 'x2');
    }
}

function increaseSpeed() {
    gameSpeed += CONFIG.SPEED_INCREASE_PER_5_BONUSES;
    background.speed = gameSpeed * 0.5;
    
    // Обновляем уровень скорости
    speedLevel = gameSpeed / CONFIG.BASE_SPEED;
    updateSpeedDisplay();
    
    // Эффект ускорения
    showSpeedEffect();
}

function showBonusEffect(x, y, text) {
    const effect = {
        x: x + CONFIG.BONUS_SIZE/2,
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
    const effect = {
        x: CONFIG.CANVAS_WIDTH / 2,
        y: CONFIG.CANVAS_HEIGHT / 2,
        text: `СКОРОСТЬ +!`,
        alpha: 1,
        size: 40
    };
    
    function animate() {
        ctx.save();
        ctx.globalAlpha = effect.alpha;
        ctx.fillStyle = '#00ff88';
        ctx.font = `bold ${effect.size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(effect.text, effect.x, effect.y);
        ctx.restore();
        
        effect.alpha -= 0.02;
        effect.size += 0.5;
        effect.y -= 0.5;
        
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

function updateSpeedDisplay() {
    document.getElementById('speedLevel').textContent = `x${speedLevel.toFixed(1)}`;
}

function endGame() {
    gameRunning = false;
    gameOver = true;
    
    // Обновление рекорда
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('lunaHighScore', highScore);
        document.getElementById('highScore').textContent = highScore;
    }
    
    // Показ экрана завершения
    document.getElementById('finalScore').textContent = score;
    setTimeout(() => {
        document.getElementById('gameOverScreen').style.display = 'flex';
    }, 500);
}

function restartGame() {
    startGame();
}

function renderStartScreen() {
    ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    
    // Фон
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    
    // Заголовок
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LUNA BAR', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 30);
    
    // Подсказка
    ctx.fillStyle = '#888';
    ctx.font = '20px sans-serif';
    ctx.fillText('Нажми СТАРТ чтобы начать', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 30);
}

// =================== ЗАПУСК ===================
window.onload = init;