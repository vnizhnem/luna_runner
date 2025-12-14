// =================== НАСТРОЙКИ ===================
const CONFIG = {
    // ОСНОВНЫЕ НАСТРОЙКИ
    GRAVITY: 0.8,
    JUMP_FORCE: -20,          // Сильнее прыжок
    DOUBLE_JUMP_FORCE: -18,
    DOUBLE_JUMP_ENABLED: true,
    
    // СКОРОСТИ (УВЕЛИЧЕНЫ!)
    BASE_SPEED: 12,           // Стартовая скорость +140% (было 5)
    SPEED_INCREASE_PER_5_BONUSES: 3.0, // За каждые 5 бонусов +3.0 скорости
    MAX_SPEED: 25,            // Максимальная скорость
    
    // РАЗМЕРЫ
    HERO_WIDTH: 128,
    HERO_HEIGHT: 128,
    MONSTER_WIDTH: 60,
    MONSTER_HEIGHT: 60,
    BONUS_SIZE: 40,
    
    // ГЕЙМПЛЕЙ
    SPAWN_INTERVAL: 1000,     // Чаще спавн (было 1500)
    BONUS_SPAWN_CHANCE: 0.45,
    MONSTER_SPAWN_CHANCE: 0.65,
    BONUS_MAX_HEIGHT: 400,
    BONUS_MIN_HEIGHT: 200,
    
    // АДАПТИВНОСТЬ
    CANVAS_RATIO: 3/4         // Соотношение 3:4 (высокое)
};

// =================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===================
let canvas, ctx;
let gameRunning = false;
let gameOver = false;
let score = 0;
let highScore = localStorage.getItem('lunaHighScore') || 0;
let gameSpeed = CONFIG.BASE_SPEED;
let totalBonusesCollected = 0;
let speedLevel = 2.0; // Начинаем с x2.0

// Статистика бонусов
let bonusStats = {
    ice: 0, fire: 0, orange: 0, pineapple: 0, coal: 0
};

// Объект героя
const hero = {
    x: 150,
    y: 0, // Установится после resize
    width: CONFIG.HERO_WIDTH,
    height: CONFIG.HERO_HEIGHT,
    velocityY: 0,
    isJumping: false,
    isOnGround: true,
    canDoubleJump: false,
    jumpCount: 0
};

// Фон для скролла
const background = {
    x1: 0,
    x2: 0, // Установится после resize
    speed: CONFIG.BASE_SPEED * 0.5
};

// Игровые объекты
let monsters = [];
let bonuses = [];
let spawnTimer = 0;

// Изображения
const images = {};
const imageQueue = [
    { key: 'hero', src: 'assets/hero.png' },
    { key: 'background', src: 'assets/background.png' },
    { key: 'monster', src: 'assets/mon3.png' },
    { key: 'ice', src: 'assets/ice.png' },
    { key: 'fire', src: 'assets/fire.png' },
    { key: 'orange', src: 'assets/orange.png' },
    { key: 'pineapple', src: 'assets/pineapple.png' },
    { key: 'coal', src: 'assets/coal.png' }
];

// =================== АДАПТИВНЫЙ РАЗМЕР КАНВАСА ===================
function updateCanvasSize() {
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    const maxWidth = canvasWrapper.clientWidth;
    const maxHeight = canvasWrapper.clientHeight;
    
    // Рассчитываем размеры с сохранением пропорций
    let width = maxWidth;
    let height = width * CONFIG.CANVAS_RATIO;
    
    if (height > maxHeight) {
        height = maxHeight;
        width = height / CONFIG.CANVAS_RATIO;
    }
    
    canvas.width = Math.floor(width);
    canvas.height = Math.floor(height);
    
    // Обновляем позиции объектов
    hero.y = canvas.height - CONFIG.HERO_HEIGHT - 20;
    hero.x = canvas.width * 0.2;
    
    background.x2 = canvas.width;
}

// =================== ЗАГРУЗКА ИЗОБРАЖЕНИЙ ===================
async function loadImages() {
    return new Promise((resolve) => {
        let loaded = 0;
        
        imageQueue.forEach(item => {
            images[item.key] = new Image();
            images[item.key].src = item.src;
            
            images[item.key].onload = () => {
                loaded++;
                if (loaded === imageQueue.length) {
                    resolve();
                }
            };
            
            images[item.key].onerror = () => {
                console.warn(`⚠️ Не загружено: ${item.src}`);
                // Создаём заглушку
                createPlaceholder(item.key);
                loaded++;
                if (loaded === imageQueue.length) resolve();
            };
        });
    });
}

function createPlaceholder(key) {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    if (key === 'hero') {
        tempCanvas.width = CONFIG.HERO_WIDTH;
        tempCanvas.height = CONFIG.HERO_HEIGHT;
        tempCtx.fillStyle = '#ffd700';
        tempCtx.fillRect(0, 0, CONFIG.HERO_WIDTH, CONFIG.HERO_HEIGHT);
        tempCtx.fillStyle = '#000';
        tempCtx.font = '20px Arial';
        tempCtx.fillText('HERO', 20, 50);
    } else if (key === 'monster') {
        tempCanvas.width = CONFIG.MONSTER_WIDTH;
        tempCanvas.height = CONFIG.MONSTER_HEIGHT;
        tempCtx.fillStyle = '#ff6b6b';
        tempCtx.fillRect(0, 0, CONFIG.MONSTER_WIDTH, CONFIG.MONSTER_HEIGHT);
        tempCtx.fillStyle = '#fff';
        tempCtx.font = '14px Arial';
        tempCtx.fillText('MON', 10, 30);
    } else {
        tempCanvas.width = CONFIG.BONUS_SIZE;
        tempCanvas.height = CONFIG.BONUS_SIZE;
        tempCtx.fillStyle = '#00ff88';
        tempCtx.fillRect(0, 0, CONFIG.BONUS_SIZE, CONFIG.BONUS_SIZE);
    }
    
    images[key] = new Image();
    images[key].src = tempCanvas.toDataURL();
}

// =================== ИНИЦИАЛИЗАЦИЯ ===================
async function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Загрузка изображений
    await loadImages();
    
    // Настройка размеров
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    window.addEventListener('orientationchange', () => {
        setTimeout(updateCanvasSize, 150);
    });
    
    // Установка начальных значений
    document.getElementById('highScore').textContent = highScore;
    updateSpeedDisplay();
    updateBonusCounters();
    
    // Настройка обработчиков событий
    setupEventListeners();
    
    // Рендер стартового экрана
    renderStartScreen();
}

function setupEventListeners() {
    // Управление касанием/кликом
    canvas.addEventListener('click', handleJump);
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleJump();
    }, { passive: false });
    
    // Управление клавиатурой
    document.addEventListener('keydown', (e) => {
        if ((e.code === 'Space' || e.code === 'ArrowUp') && gameRunning) {
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
    // Скрываем экраны
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('newRecordBadge').style.display = 'none';
    
    // Сброс состояния
    gameRunning = true;
    gameOver = false;
    score = 0;
    gameSpeed = CONFIG.BASE_SPEED;
    speedLevel = 2.0;
    totalBonusesCollected = 0;
    background.speed = gameSpeed * 0.5;
    
    // Сброс статистики
    bonusStats = { ice: 0, fire: 0, orange: 0, pineapple: 0, coal: 0 };
    updateBonusCounters();
    updateSpeedDisplay();
    
    // Сброс героя
    hero.y = canvas.height - CONFIG.HERO_HEIGHT - 20;
    hero.velocityY = 0;
    hero.isJumping = false;
    hero.isOnGround = true;
    hero.canDoubleJump = false;
    hero.jumpCount = 0;
    
    // Очистка объектов
    monsters = [];
    bonuses = [];
    spawnTimer = 0;
    
    // Обновление интерфейса
    document.getElementById('currentScore').textContent = score;
    
    // Запуск игрового цикла
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
        spawnTimer -= 1000 / 60;
    }
    
    // Физика героя
    hero.velocityY += CONFIG.GRAVITY;
    hero.y += hero.velocityY;
    
    // Проверка земли
    const groundY = canvas.height - CONFIG.HERO_HEIGHT - 20;
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
    
    if (background.x1 <= -canvas.width) {
        background.x1 = canvas.width;
    }
    if (background.x2 <= -canvas.width) {
        background.x2 = canvas.width;
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
        if (monsters[i].x < -CONFIG.MONSTER_WIDTH * 2) {
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
        else if (bonuses[i].x < -CONFIG.BONUS_SIZE * 2) {
            bonuses.splice(i, 1);
        }
    }
}

function render() {
    // Очистка
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Фон
    if (images.background && images.background.complete) {
        ctx.drawImage(images.background, 
            background.x1, 0, 
            canvas.width, canvas.height
        );
        ctx.drawImage(images.background, 
            background.x2, 0, 
            canvas.width, canvas.height
        );
    } else {
        // Запасной фон
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Бонусы с анимацией
    bonuses.forEach(bonus => {
        if (images[bonus.type] && images[bonus.type].complete) {
            const pulse = Math.sin(Date.now() * 0.005) * 4;
            const rotation = Math.sin(Date.now() * 0.003) * 0.1;
            
            ctx.save();
            ctx.translate(
                bonus.x + CONFIG.BONUS_SIZE / 2,
                bonus.y + CONFIG.BONUS_SIZE / 2
            );
            ctx.rotate(rotation);
            
            // Свечение
            ctx.shadowColor = '#00ff88';
            ctx.shadowBlur = 10;
            
            ctx.drawImage(
                images[bonus.type],
                -CONFIG.BONUS_SIZE / 2 - pulse / 2,
                -CONFIG.BONUS_SIZE / 2 - pulse / 2,
                CONFIG.BONUS_SIZE + pulse,
                CONFIG.BONUS_SIZE + pulse
            );
            
            ctx.restore();
        }
    });
    
    // Монстры
    monsters.forEach(monster => {
        if (images.monster && images.monster.complete) {
            // Тень под монстром
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(
                monster.x + 8,
                monster.y + monster.height - 5,
                monster.width - 16,
                8
            );
            ctx.restore();
            
            // Сам монстр
            ctx.drawImage(
                images.monster,
                monster.x, monster.y,
                monster.width, monster.height
            );
        }
    });
    
    // Герой
    if (images.hero && images.hero.complete) {
        // Тень под героем
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(
            hero.x + hero.width / 2,
            hero.y + hero.height + 8,
            hero.width / 3 * (1 - hero.velocityY * 0.01),
            hero.height / 10,
            0, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
        
        // Сам герой
        ctx.drawImage(
            images.hero,
            hero.x, hero.y,
            hero.width, hero.height
        );
    }
}

// =================== ИГРОВЫЕ МЕХАНИКИ ===================
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
            y: canvas.height - CONFIG.MONSTER_HEIGHT - 20,
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

function checkCollision(rect1, rect2) {
    // Уменьшенные hitbox для более честной игры
    const padding = 15;
    return rect1.x + padding < rect2.x + rect2.width - padding &&
           rect1.x + rect1.width - padding > rect2.x + padding &&
           rect1.y + padding < rect2.y + rect2.height - padding &&
           rect1.y + rect1.height - padding > rect2.y + padding;
}

function collectBonus(bonus) {
    totalBonusesCollected++;
    bonusStats[bonus.type]++;
    updateBonusCounters();
    
    // Увеличение скорости каждые 5 бонусов
    if (totalBonusesCollected % 5 === 0) {
        increaseSpeed();
    }
    
    // Начисление очков
    if (bonus.type !== 'coal') {
        const points = bonus.value;
        score += points;
        document.getElementById('currentScore').textContent = score;
        
        // Эффект сбора
        showCollectEffect(bonus.x + bonus.width/2, bonus.y, `+${points}`);
    } else {
        showCollectEffect(bonus.x + bonus.width/2, bonus.y, 'x2!');
    }
}

function increaseSpeed() {
    gameSpeed += CONFIG.SPEED_INCREASE_PER_5_BONUSES;
    background.speed = gameSpeed * 0.5;
    
    // Обновление уровня скорости
    speedLevel = gameSpeed / CONFIG.BASE_SPEED * 2;
    updateSpeedDisplay();
    
    // Эффект ускорения
    showSpeedEffect();
}

function showCollectEffect(x, y, text) {
    const effect = {
        x: x,
        y: y,
        text: text,
        alpha: 1,
        velocityY: -1.5,
        size: 22
    };
    
    function animate() {
        ctx.save();
        ctx.globalAlpha = effect.alpha;
        ctx.fillStyle = text === 'x2!' ? '#ffd700' : '#00ff88';
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
    speedElement.classList.add('speed-flash');
    
    // Мигание скорости
    let flashes = 0;
    const flashInterval = setInterval(() => {
        speedElement.style.color = flashes % 2 === 0 ? '#ffffff' : '#00ff88';
        flashes++;
        
        if (flashes > 5) {
            clearInterval(flashInterval);
            speedElement.style.color = '#00ff88';
            speedElement.classList.remove('speed-flash');
        }
    }, 100);
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
    
    // Проверка рекорда
    const isNewRecord = score > highScore;
    if (isNewRecord) {
        highScore = score;
        localStorage.setItem('lunaHighScore', highScore);
        document.getElementById('highScore').textContent = highScore;
        document.getElementById('newRecordBadge').style.display = 'block';
    }
    
    // Показ экрана завершения
    document.getElementById('finalScore').textContent = score;
    
    setTimeout(() => {
        document.getElementById('gameOverScreen').style.display = 'flex';
    }, 600);
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
    ctx.font = `bold ${Math.min(48, canvas.width / 8)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LUNA BAR', canvas.width / 2, canvas.height / 2 - 40);
    
    // Подсказка
    ctx.fillStyle = '#888';
    ctx.font = `${Math.min(18, canvas.width / 20)}px sans-serif`;
    ctx.fillText('Жди заказ • Собирай бонусы', canvas.width / 2, canvas.height / 2);
}

// =================== ЗАПУСК ===================
window.onload = init;