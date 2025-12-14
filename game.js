// =================== КОНСТАНТЫ И НАСТРОЙКИ ===================
const CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    GRAVITY: 0.8,
    JUMP_FORCE: -16,
    GAME_SPEED: 5,
    HERO_WIDTH: 64,
    HERO_HEIGHT: 64,
    OBSTACLE_WIDTH: 50,
    OBSTACLE_HEIGHT: 50,
    BONUS_SIZE: 50,
    GROUND_HEIGHT: 50,
    SPAWN_INTERVAL: 1500, // мс
    BONUS_SPAWN_CHANCE: 0.3, // 30%
    MONSTER_SPAWN_CHANCE: 0.6 // 60%
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

// =================== ОБЪЕКТЫ ИГРЫ ===================
const hero = {
    x: 150,
    y: CONFIG.CANVAS_HEIGHT - CONFIG.HERO_HEIGHT - CONFIG.GROUND_HEIGHT,
    width: CONFIG.HERO_WIDTH,
    height: CONFIG.HERO_HEIGHT,
    velocityY: 0,
    isJumping: false,
    isOnGround: true
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
images.hero.src = 'assets/hero.png';
images.background.src = 'assets/background.png';
images.mon1.src = 'assets/mon1.png';
images.mon2.src = 'assets/mon2.png';
images.mon3.src = 'assets/mon3.png';
images.ice.src = 'assets/ice.png';
images.fire.src = 'assets/fire.png';
images.orange.src = 'assets/orange.png';
images.pineapple.src = 'assets/pineapple.png';
images.coal.src = 'assets/coal.png';

// =================== ИНИЦИАЛИЗАЦИЯ ===================
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Установка высокого счета
    document.getElementById('highScore').textContent = highScore;
    
    // Обработчики событий
    canvas.addEventListener('click', handleJump);
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            handleJump();
        }
    });
    
    document.getElementById('restartBtn').addEventListener('click', restartGame);
    
    // Начать игру при загрузке изображений
    const imagesLoaded = Object.values(images).every(img => img.complete);
    if (imagesLoaded) {
        startGame();
    } else {
        Promise.all(Object.values(images).map(img => {
            if (!img.complete) {
                return new Promise(resolve => {
                    img.onload = resolve;
                });
            }
        })).then(startGame);
    }
}

// =================== ИГРОВАЯ ЛОГИКА ===================
function startGame() {
    gameRunning = true;
    gameOver = false;
    score = 0;
    gameSpeed = CONFIG.GAME_SPEED;
    multiplier = 1;
    multiplierTimer = 0;
    
    // Сброс позиций
    hero.y = CONFIG.CANVAS_HEIGHT - CONFIG.HERO_HEIGHT - CONFIG.GROUND_HEIGHT;
    hero.velocityY = 0;
    hero.isJumping = false;
    
    obstacles = [];
    bonuses = [];
    spawnTimer = 0;
    
    // Обновить интерфейс
    document.getElementById('currentScore').textContent = score;
    document.body.classList.remove('game-over');
    
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
        if (multiplierTimer <= 0) {
            multiplier = 1;
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
        const pulse = Math.sin(Date.now() * 0.005) * 2;
        const size = CONFIG.BONUS_SIZE + pulse;
        const offset = (CONFIG.BONUS_SIZE - size) / 2;
        
        ctx.drawImage(bonus.img, 
            bonus.x + offset, 
            bonus.y + offset, 
            size, 
            size);
    });
    
    // Нарисовать множитель (если активен)
    if (multiplier > 1) {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.7)';
        ctx.font = 'bold 24px Courier New';
        ctx.textAlign = 'right';
        ctx.fillText(`x${multiplier}`, CONFIG.CANVAS_WIDTH - 20, 40);
        
        // Таймер множителя
        const timeLeft = Math.ceil(multiplierTimer / 1000);
        ctx.font = '18px Courier New';
        ctx.fillText(`${timeLeft}с`, CONFIG.CANVAS_WIDTH - 20, 70);
    }
}

// =================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===================
function handleJump() {
    if (!gameRunning || gameOver) return;
    
    if (hero.isOnGround) {
        hero.velocityY = CONFIG.JUMP_FORCE;
        hero.isJumping = true;
        hero.isOnGround = false;
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
    
    // Шанс спавна бонуса
    if (Math.random() < CONFIG.BONUS_SPAWN_CHANCE) {
        const bonusTypes = [
            { img: images.ice, value: 1, type: 'ice' },
            { img: images.fire, value: 2, type: 'fire' },
            { img: images.orange, value: 3, type: 'orange' },
            { img: images.pineapple, value: 5, type: 'pineapple' },
            { img: images.coal, value: 0, type: 'coal' }
        ];
        
        const bonus = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
        
        // Случайная высота для бонуса
        const minY = 100;
        const maxY = CONFIG.CANVAS_HEIGHT - CONFIG.BONUS_SIZE - CONFIG.GROUND_HEIGHT - 50;
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
    
    if (bonus.type === 'coal') {
        multiplier = 2;
        multiplierTimer = 10000; // 10 секунд
        points = 0;
    } else {
        points *= multiplier;
        score += points;
    }
    
    // Обновить интерфейс
    document.getElementById('currentScore').textContent = score;
    
    // Визуальный эффект сбора
    createBonusEffect(bonus.x, bonus.y, points > 0 ? `+${points}` : 'x2!');
}

function createBonusEffect(x, y, text) {
    const effect = {
        x: x,
        y: y,
        text: text,
        alpha: 1,
        velocityY: -2
    };
    
    function animate() {
        ctx.fillStyle = `rgba(255, 215, 0, ${effect.alpha})`;
        ctx.font = 'bold 20px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(effect.text, effect.x + 25, effect.y);
        
        effect.y += effect.velocityY;
        effect.alpha -= 0.02;
        
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
        
        // Эффект нового рекорда
        ctx.fillStyle = 'rgba(239, 71, 111, 0.8)';
        ctx.font = 'bold 40px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('НОВЫЙ РЕКОРД!', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2);
    }
    
    // Показать кнопку рестарта
    document.body.classList.add('game-over');
}

function restartGame() {
    startGame();
}

// =================== ЗАПУСК ИГРЫ ===================
window.onload = init;