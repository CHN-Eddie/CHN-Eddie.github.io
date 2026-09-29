/**
 * 优化版星空顶 - 动态星空 + 流星雨 + 鼠标移动产生蓝色烟花
 * 版本：适中大小星星 + 明显忽明忽暗闪烁 + 无停留光晕
 */

(function() {
    'use strict';
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStarrySky);
    } else {
        initStarrySky();
    }
    
    function initStarrySky() {
        // 1. 获取或创建Canvas容器
        const container = document.getElementById('web_bg') || document.body;
        const existingCanvas = container.querySelector('.starry-sky-canvas');
        if (existingCanvas) existingCanvas.remove();
        
        const canvas = document.createElement('canvas');
        canvas.className = 'starry-sky-canvas';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.zIndex = '-1';
        canvas.style.pointerEvents = 'none';
        
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        
        // 2. 鼠标交互变量
        let mouseX = -100, mouseY = -100;
        let lastMouseX = -100, lastMouseY = -100;
        
        // 3. 核心数据存储
        const stars = [];
        const meteors = [];
        const mouseMeteors = []; // 鼠标烟花粒子
        let meteorTimer = null;
        let mouseMoved = false;
        let lastMouseMoveTime = 0;
        const MOUSE_STATIONARY_THRESHOLD = 100; // 鼠标静止阈值(ms)
        
        // 4. 配置参数（增加明显的忽明忽暗效果）
        const config = {
            // 基础星空 - 星星大小调整为适中
            starCount: 550,
            starSizeRange: [0.15, 1.0],
            baseBrightnessRange: [0.1, 0.3], // 降低基础亮度，让闪烁更明显
            twinkleSpeedRange: [0.01, 0.03], // 减慢闪烁速度，更明显
            twinkleAmplitude: 0.7, // 增加闪烁幅度
            
            // 新增：明显的忽明忽暗参数
            fadeInOutChance: 0.003, // 忽明忽暗的概率
            fadeInOutDurationRange: [60, 180], // 忽明忽暗的持续时间（帧）
            minFadeBrightness: 0.05, // 最暗时的亮度
            maxFadeBrightness: 0.9, // 最亮时的亮度
            
            // 新增：呼吸效果参数
            breathSpeedRange: [0.002, 0.006], // 呼吸效果速度
            breathAmplitudeRange: [0.15, 0.35], // 呼吸效果幅度
            
            // 快速闪烁参数
            quickFlashChance: 0.001, // 快速闪烁的概率
            quickFlashDurationRange: [5, 15], // 快速闪烁持续时间
            
            starColors: ['#FFFFFF', '#F0F8FF', '#E6F0FF', '#FFF0F5', '#F0FFF0'],
            
            // 流星雨
            meteorBaseInterval: [800, 2000],
            meteorRainIntensity: 0.8,
            meteorRainBurstChance: 0.1,
            meteorRainBurstAmount: [1, 3],
            meteorSpeedRange: [6, 15],
            meteorLengthRange: [40, 120],
            meteorWidthRange: [0.5, 1.5],
            meteorColorPalette: ['#5D95FF', '#70A0FF', '#83ABFF'],
            
            // 鼠标蓝色烟花（只在移动时产生）
            mouseMeteorEnabled: true,
            mouseMeteorMinDistance: 5,
            mouseMeteorCount: 1,
            mouseMeteorSpeed: 1.5,
            mouseMeteorSizeRange: [0.4, 1.0],
            mouseMeteorColors: ['#4A8BFF', '#6EA3FF', '#8BB9FF'],
            mouseMeteorDecay: 0.02,
            mouseMeteorLife: 0.8,
            mouseMeteorGravity: 0.03,
            mouseMeteorFriction: 0.97,
            mouseMeteorWander: 0.01,
            
            // 背景颜色
            bgColor: 'rgba(8, 12, 24, 0.1)'
        };
        
        // 5. 画布尺寸调整函数
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initStars();
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        // 6. 鼠标事件监听
        document.addEventListener('mousemove', (e) => {
            const now = Date.now();
            
            const dx = e.clientX - lastMouseX;
            const dy = e.clientY - lastMouseY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            lastMouseX = mouseX;
            lastMouseY = mouseY;
            mouseX = e.clientX;
            mouseY = e.clientY;
            
            if (distance > config.mouseMeteorMinDistance && config.mouseMeteorEnabled) {
                mouseMoved = true;
                lastMouseMoveTime = now;
                createMouseMeteor();
            }
        });
        
        document.addEventListener('mouseleave', () => {
            mouseX = -100;
            mouseY = -100;
            mouseMoved = false;
        });
        
        // ==================== 核心函数 ====================
        
        // 7.1 基础星空（增加明显忽明忽暗效果）
        function initStars() {
            stars.length = 0;
            
            for (let i = 0; i < config.starCount; i++) {
                const starColor = config.starColors[
                    Math.floor(Math.random() * config.starColors.length)
                ];
                
                // 创建大小分布
                let sizeMultiplier = 1;
                const rand = Math.random();
                if (rand < 0.7) {
                    sizeMultiplier = 0.8; // 小星星
                } else if (rand < 0.95) {
                    sizeMultiplier = 1.2; // 中星星
                } else {
                    sizeMultiplier = 1.8; // 大星星
                }
                
                const baseSize = (config.starSizeRange[0] + Math.random() * (config.starSizeRange[1] - config.starSizeRange[0])) * sizeMultiplier;
                
                // 随机忽明忽暗起始状态
                const isFadingIn = Math.random() > 0.5;
                const fadeProgress = Math.random(); // 随机开始进度
                
                const star = {
                    id: i,
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    baseSize: baseSize,
                    
                    // 基础亮度（较低，让闪烁更明显）
                    baseBrightness: config.baseBrightnessRange[0] + Math.random() * (config.baseBrightnessRange[1] - config.baseBrightnessRange[0]),
                    
                    // 正常闪烁参数（较慢，更明显）
                    normalTwinkleSpeed: config.twinkleSpeedRange[0] + Math.random() * (config.twinkleSpeedRange[1] - config.twinkleSpeedRange[0]),
                    normalTwinklePhase: Math.random() * Math.PI * 2,
                    
                    // 新增：呼吸效果
                    breathSpeed: config.breathSpeedRange[0] + Math.random() * (config.breathSpeedRange[1] - config.breathSpeedRange[0]),
                    breathPhase: Math.random() * Math.PI * 2,
                    breathAmplitude: config.breathAmplitudeRange[0] + Math.random() * (config.breathAmplitudeRange[1] - config.breathAmplitudeRange[0]),
                    
                    // 新增：忽明忽暗状态
                    isFading: Math.random() < 0.3, // 30%的星星开始时就在忽明忽暗
                    fadeInOut: isFadingIn,
                    fadeProgress: fadeProgress,
                    fadeDuration: config.fadeInOutDurationRange[0] + Math.random() * (config.fadeInOutDurationRange[1] - config.fadeInOutDurationRange[0]),
                    fadeTimer: Math.floor(fadeProgress * (config.fadeInOutDurationRange[0] + Math.random() * (config.fadeInOutDurationRange[1] - config.fadeInOutDurationRange[0]))),
                    
                    // 快速闪烁状态
                    isQuickFlashing: false,
                    quickFlashTimer: 0,
                    quickFlashIntensity: 0,
                    
                    // 分组信息
                    groupId: Math.floor(Math.random() * 20),
                    
                    // 移动参数
                    speedX: (Math.random() - 0.5) * 0.01 * (1 / sizeMultiplier),
                    speedY: (Math.random() - 0.5) * 0.01 * (1 / sizeMultiplier),
                    
                    color: starColor,
                    
                    // 星星类型
                    type: sizeMultiplier < 1 ? 0 : (sizeMultiplier < 1.5 ? 1 : 2),
                    
                    // 当前显示参数
                    currentBrightness: 0,
                    currentSize: 0,
                    
                    // 用于调试
                    debug: false
                };
                
                // 初始化当前亮度（根据忽明忽暗状态）
                if (star.isFading) {
                    star.currentBrightness = star.fadeInOut ? 
                        config.minFadeBrightness + (config.maxFadeBrightness - config.minFadeBrightness) * star.fadeProgress :
                        config.maxFadeBrightness - (config.maxFadeBrightness - config.minFadeBrightness) * star.fadeProgress;
                } else {
                    star.currentBrightness = star.baseBrightness;
                }
                
                star.currentSize = baseSize;
                stars.push(star);
            }
        }
        
        function updateStars() {
            const time = Date.now() * 0.001;
            
            // 随机触发忽明忽暗效果
            for (const star of stars) {
                if (!star.isFading && Math.random() < config.fadeInOutChance) {
                    star.isFading = true;
                    star.fadeInOut = Math.random() > 0.5;
                    star.fadeProgress = 0;
                    star.fadeTimer = 0;
                    star.fadeDuration = config.fadeInOutDurationRange[0] + Math.random() * (config.fadeInOutDurationRange[1] - config.fadeInOutDurationRange[0]);
                }
                
                // 随机触发快速闪烁
                if (!star.isQuickFlashing && Math.random() < config.quickFlashChance) {
                    star.isQuickFlashing = true;
                    star.quickFlashTimer = config.quickFlashDurationRange[0] + Math.random() * (config.quickFlashDurationRange[1] - config.quickFlashDurationRange[0]);
                    star.quickFlashIntensity = 0.7 + Math.random() * 0.3;
                }
            }
            
            // 更新所有星星
            for (const star of stars) {
                // 基础亮度
                let baseBrightness = star.baseBrightness;
                
                // 正常闪烁效果
                let normalBrightness = Math.sin(time * star.normalTwinkleSpeed + star.normalTwinklePhase) * config.twinkleAmplitude * 0.4;
                
                // 呼吸效果
                let breathBrightness = Math.sin(time * star.breathSpeed + star.breathPhase) * star.breathAmplitude;
                
                // 处理忽明忽暗效果
                if (star.isFading) {
                    star.fadeTimer++;
                    star.fadeProgress = star.fadeTimer / star.fadeDuration;
                    
                    if (star.fadeProgress >= 1) {
                        // 完成一次循环，切换方向或结束
                        if (Math.random() < 0.3) {
                            // 30%几率停止忽明忽暗
                            star.isFading = false;
                            star.fadeProgress = 0;
                        } else {
                            // 切换方向继续
                            star.fadeInOut = !star.fadeInOut;
                            star.fadeTimer = 0;
                            star.fadeProgress = 0;
                            star.fadeDuration = config.fadeInOutDurationRange[0] + Math.random() * (config.fadeInOutDurationRange[1] - config.fadeInOutDurationRange[0]);
                        }
                    }
                    
                    // 计算忽明忽暗亮度
                    let fadeBrightness;
                    if (star.fadeInOut) {
                        // 渐亮
                        fadeBrightness = config.minFadeBrightness + (config.maxFadeBrightness - config.minFadeBrightness) * star.fadeProgress;
                    } else {
                        // 渐暗
                        fadeBrightness = config.maxFadeBrightness - (config.maxFadeBrightness - config.minFadeBrightness) * star.fadeProgress;
                    }
                    
                    // 忽明忽暗效果覆盖基础亮度
                    baseBrightness = fadeBrightness;
                }
                
                // 处理快速闪烁
                if (star.isQuickFlashing) {
                    star.quickFlashTimer--;
                    
                    if (star.quickFlashTimer <= 0) {
                        star.isQuickFlashing = false;
                        star.quickFlashIntensity = 0;
                    } else {
                        // 快速闪烁效果（短时间高亮度）
                        const flashFactor = star.quickFlashTimer / (config.quickFlashDurationRange[0] + config.quickFlashDurationRange[1]) * 2;
                        const flashBrightness = star.quickFlashIntensity * flashFactor;
                        
                        // 快速闪烁时非常亮
                        baseBrightness = Math.max(baseBrightness, flashBrightness);
                    }
                }
                
                // 合并所有效果
                let finalBrightness = baseBrightness + normalBrightness + breathBrightness;
                
                // 添加随机微光（让星星有微小抖动）
                const microFlicker = (Math.random() - 0.5) * 0.08;
                finalBrightness += microFlicker;
                
                // 限制亮度范围
                star.currentBrightness = Math.max(0.02, Math.min(1.0, finalBrightness));
                
                // 大小随亮度变化（更明显）
                star.currentSize = star.baseSize * (0.7 + star.currentBrightness * 0.5);
                
                // 轻微移动
                star.x += star.speedX;
                star.y += star.speedY;
                
                // 边界处理
                if (star.x < -20) star.x = canvas.width + 20;
                if (star.x > canvas.width + 20) star.x = -20;
                if (star.y < -20) star.y = canvas.height + 20;
                if (star.y > canvas.height + 20) star.y = -20;
                
                // 调试信息
                if (star.debug) {
                    console.log(`星星 ${star.id}: 亮度=${star.currentBrightness.toFixed(3)}, 大小=${star.currentSize.toFixed(3)}, 忽明忽暗=${star.isFading}, 快速闪烁=${star.isQuickFlashing}`);
                }
            }
        }
        
        function drawStars() {
            const time = Date.now() * 0.001;
            
            // 先绘制小星星，再绘制大星星（避免大星星被遮挡）
            const sortedStars = [...stars].sort((a, b) => a.currentSize - b.currentSize);
            
            for (const star of sortedStars) {
                const alpha = star.currentBrightness;
                const size = star.currentSize;
                
                // 为较亮的星星绘制光晕
                if (alpha > 0.15) {
                    let glowSize;
                    let glowAlpha;
                    
                    if (star.type === 2) { // 大星星
                        glowSize = size * 3;
                        glowAlpha = alpha * 0.6;
                    } else if (star.type === 1) { // 中星星
                        glowSize = size * 2.5;
                        glowAlpha = alpha * 0.4;
                    } else { // 小星星
                        glowSize = size * 2;
                        glowAlpha = alpha * 0.3;
                    }
                    
                    // 忽明忽暗的星星有更强的光晕
                    if (star.isFading) {
                        glowAlpha *= 1.5;
                    }
                    
                    const gradient = ctx.createRadialGradient(
                        star.x, star.y, 0,
                        star.x, star.y, glowSize
                    );
                    
                    gradient.addColorStop(0, `rgba(255, 255, 255, ${glowAlpha})`);
                    gradient.addColorStop(0.6, `rgba(255, 255, 255, ${glowAlpha * 0.3})`);
                    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    
                    ctx.beginPath();
                    ctx.fillStyle = gradient;
                    ctx.arc(star.x, star.y, glowSize, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                // 绘制星星主体
                ctx.beginPath();
                
                // 根据星星类型和亮度调整颜色
                let r = 255, g = 255, b = 255;
                const colorVariation = Math.sin(time * 0.15 + star.x * 0.0005 + star.y * 0.0005) * 0.12;
                
                if (star.color !== '#FFFFFF') {
                    if (star.color === '#F0F8FF') { r = 240; g = 248; b = 255; }
                    else if (star.color === '#E6F0FF') { r = 230; g = 240; b = 255; }
                    else if (star.color === '#FFF0F5') { r = 255; g = 240; b = 245; }
                    else if (star.color === '#F0FFF0') { r = 240; g = 255; b = 240; }
                }
                
                // 颜色随亮度变化
                const variationFactor = 20 + alpha * 30;
                r = Math.min(255, Math.max(180, r + colorVariation * variationFactor));
                g = Math.min(255, Math.max(180, g + colorVariation * variationFactor));
                b = Math.min(255, Math.max(180, b + colorVariation * variationFactor));
                
                // 忽明忽暗的星星颜色更丰富
                if (star.isFading) {
                    const fadeColor = Math.sin(time * 0.2 + star.id * 0.1) * 0.1;
                    r = Math.min(255, Math.max(150, r + fadeColor * 50));
                    g = Math.min(255, Math.max(150, g + fadeColor * 30));
                    b = Math.min(255, Math.max(150, b - fadeColor * 20));
                }
                
                ctx.fillStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${alpha})`;
                ctx.arc(star.x, star.y, size, 0, Math.PI * 2);
                ctx.fill();
                
                // 为大星星添加星芒效果（在忽明忽暗时更明显）
                if (star.type >= 1 && alpha > 0.4) {
                    const spikeCount = star.type === 2 ? 6 : 4;
                    const spikeLength = size * (1.2 + Math.sin(time * 0.3) * 0.3);
                    
                    for (let i = 0; i < spikeCount; i++) {
                        const angle = (i / spikeCount) * Math.PI + time * 0.08;
                        const endX = star.x + Math.cos(angle) * spikeLength;
                        const endY = star.y + Math.sin(angle) * spikeLength;
                        
                        const spikeAlpha = alpha * (0.4 + Math.sin(time * 0.5 + i) * 0.2);
                        const spikeGradient = ctx.createLinearGradient(
                            star.x, star.y,
                            endX, endY
                        );
                        
                        spikeGradient.addColorStop(0, `rgba(255, 255, 255, ${spikeAlpha})`);
                        spikeGradient.addColorStop(0.7, `rgba(255, 255, 255, ${spikeAlpha * 0.4})`);
                        spikeGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                        
                        ctx.beginPath();
                        ctx.strokeStyle = spikeGradient;
                        ctx.lineWidth = size * 0.25;
                        ctx.lineCap = 'round';
                        ctx.moveTo(star.x, star.y);
                        ctx.lineTo(endX, endY);
                        ctx.stroke();
                    }
                }
            }
        }
        
        // 7.2 流星雨系统
        function createMeteorBurst(amount) {
            for (let i = 0; i < amount; i++) {
                const centerX = Math.random() * canvas.width;
                const startX = centerX + (Math.random() - 0.5) * 100;
                const startY = -10 - Math.random() * 20;
                const angle = Math.PI / 3.5 + (Math.random() - 0.5) * Math.PI / 8;
                const color = config.meteorColorPalette[
                    Math.floor(Math.random() * config.meteorColorPalette.length)
                ];
                
                meteors.push({
                    x: startX, y: startY,
                    vx: Math.sin(angle) * (config.meteorSpeedRange[0] + Math.random() * (config.meteorSpeedRange[1] - config.meteorSpeedRange[0])),
                    vy: Math.cos(angle) * (config.meteorSpeedRange[0] + Math.random() * (config.meteorSpeedRange[1] - config.meteorSpeedRange[0])),
                    length: config.meteorLengthRange[0] + Math.random() * (config.meteorLengthRange[1] - config.meteorLengthRange[0]),
                    width: config.meteorWidthRange[0] + Math.random() * (config.meteorWidthRange[1] - config.meteorWidthRange[0]),
                    life: 1.0, 
                    decay: 0.01 + Math.random() * 0.005,
                    color: color, 
                    trail: [], 
                    maxTrailPoints: 5,
                    gravity: 0,
                    friction: 1.0
                });
            }
        }
        
        // 7.3 鼠标蓝色烟花
        function createMouseMeteor() {
            if (!config.mouseMeteorEnabled) return;
            
            for (let i = 0; i < config.mouseMeteorCount; i++) {
                const offsetX = (Math.random() - 0.5) * 8;
                const offsetY = (Math.random() - 0.5) * 8;
                const baseAngle = Math.PI * 1.5;
                const spread = Math.PI * 0.3;
                const angle = baseAngle + (Math.random() - 0.5) * spread;
                const speed = config.mouseMeteorSpeed * (0.7 + Math.random() * 0.6);
                const color = config.mouseMeteorColors[
                    Math.floor(Math.random() * config.mouseMeteorColors.length)
                ];
                
                mouseMeteors.push({
                    x: mouseX + offsetX,
                    y: mouseY + offsetY,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: config.mouseMeteorSizeRange[0] + Math.random() * (config.mouseMeteorSizeRange[1] - config.mouseMeteorSizeRange[0]),
                    life: config.mouseMeteorLife,
                    decay: config.mouseMeteorDecay + Math.random() * 0.005,
                    color: color,
                    trail: [],
                    maxTrailPoints: 3,
                    gravity: config.mouseMeteorGravity * (0.8 + Math.random() * 0.4),
                    friction: config.mouseMeteorFriction,
                    wander: config.mouseMeteorWander,
                    rotation: Math.random() * Math.PI * 2,
                    rotationSpeed: (Math.random() - 0.5) * 0.03
                });
            }
        }
        
        function scheduleNextMeteor() {
            if (meteorTimer) clearTimeout(meteorTimer);
            const baseInterval = config.meteorBaseInterval[0] + 
                Math.random() * (config.meteorBaseInterval[1] - config.meteorBaseInterval[0]);
            const actualInterval = baseInterval / config.meteorRainIntensity;
            
            meteorTimer = setTimeout(() => {
                if (Math.random() < config.meteorRainBurstChance) {
                    const burstAmount = config.meteorRainBurstAmount[0] + 
                        Math.floor(Math.random() * (config.meteorRainBurstAmount[1] - config.meteorRainBurstAmount[0]));
                    createMeteorBurst(burstAmount);
                } else {
                    createMeteorBurst(1);
                }
                scheduleNextMeteor();
            }, actualInterval);
        }
        
        function updateMeteors() {
            const now = Date.now();
            
            if (now - lastMouseMoveTime > MOUSE_STATIONARY_THRESHOLD) {
                mouseMoved = false;
            }
            
            for (let i = meteors.length - 1; i >= 0; i--) {
                const meteor = meteors[i];
                
                meteor.x += meteor.vx;
                meteor.y += meteor.vy;
                
                meteor.trail.unshift({ 
                    x: meteor.x, 
                    y: meteor.y,
                    life: meteor.life
                });
                if (meteor.trail.length > meteor.maxTrailPoints) {
                    meteor.trail.pop();
                }
                
                meteor.life -= meteor.decay;
                
                const isOutOfBounds = meteor.y > canvas.height + 100 || 
                                      meteor.x < -100 || 
                                      meteor.x > canvas.width + 100;
                
                if (isOutOfBounds || meteor.life <= 0) {
                    meteors.splice(i, 1);
                }
            }
            
            for (let i = mouseMeteors.length - 1; i >= 0; i--) {
                const meteor = mouseMeteors[i];
                
                meteor.vx *= meteor.friction;
                meteor.vy *= meteor.friction;
                meteor.vy += meteor.gravity;
                meteor.vx += (Math.random() - 0.5) * meteor.wander;
                meteor.vy += (Math.random() - 0.5) * meteor.wander;
                meteor.rotation += meteor.rotationSpeed;
                meteor.x += meteor.vx;
                meteor.y += meteor.vy;
                
                meteor.trail.unshift({ 
                    x: meteor.x, 
                    y: meteor.y,
                    life: meteor.life
                });
                if (meteor.trail.length > meteor.maxTrailPoints) {
                    meteor.trail.pop();
                }
                
                meteor.life -= meteor.decay;
                
                const isOutOfBounds = meteor.y > canvas.height + 30 || 
                                      meteor.x < -30 || 
                                      meteor.x > canvas.width + 30;
                
                if (isOutOfBounds || meteor.life <= 0) {
                    mouseMeteors.splice(i, 1);
                }
            }
        }
        
        function drawMeteors() {
            for (const meteor of meteors) {
                for (let i = 0; i < meteor.trail.length; i++) {
                    if (i < meteor.trail.length - 1) {
                        const point = meteor.trail[i];
                        const nextPoint = meteor.trail[i + 1];
                        const trailAlpha = (meteor.life * (1 - i / meteor.trail.length)) * 0.5;
                        const lineWidth = meteor.width * (1 - i / meteor.trail.length) * 0.6;
                        
                        ctx.beginPath();
                        ctx.strokeStyle = meteor.color.replace(')', `, ${trailAlpha})`).replace('rgb', 'rgba');
                        ctx.lineWidth = lineWidth;
                        ctx.lineCap = 'round';
                        ctx.moveTo(point.x, point.y);
                        ctx.lineTo(nextPoint.x, nextPoint.y);
                        ctx.stroke();
                    }
                }
                
                if (meteor.trail.length > 0) {
                    const head = meteor.trail[0];
                    const headAlpha = meteor.life * 0.7;
                    const headSize = meteor.width * 0.8;
                    
                    const gradient = ctx.createRadialGradient(
                        head.x, head.y, 0,
                        head.x, head.y, headSize * 2
                    );
                    gradient.addColorStop(0, meteor.color.replace(')', `, ${headAlpha})`).replace('rgb', 'rgba'));
                    gradient.addColorStop(1, meteor.color.replace(')', `, 0)`).replace('rgb', 'rgba'));
                    
                    ctx.beginPath();
                    ctx.fillStyle = gradient;
                    ctx.arc(head.x, head.y, headSize * 2, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.beginPath();
                    ctx.fillStyle = `rgba(255, 255, 255, ${headAlpha})`;
                    ctx.arc(head.x, head.y, headSize * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            
            for (const meteor of mouseMeteors) {
                for (let i = 0; i < meteor.trail.length; i++) {
                    if (i < meteor.trail.length - 1) {
                        const point = meteor.trail[i];
                        const nextPoint = meteor.trail[i + 1];
                        const trailAlpha = (meteor.life * (1 - i / meteor.trail.length)) * 0.3;
                        const lineWidth = meteor.size * (1 - i / meteor.trail.length) * 0.2;
                        
                        ctx.beginPath();
                        ctx.strokeStyle = meteor.color.replace(')', `, ${trailAlpha})`).replace('rgb', 'rgba');
                        ctx.lineWidth = lineWidth;
                        ctx.lineCap = 'round';
                        ctx.moveTo(point.x, point.y);
                        ctx.lineTo(nextPoint.x, nextPoint.y);
                        ctx.stroke();
                    }
                }
                
                const alpha = meteor.life * 0.5;
                const size = meteor.size * 0.6;
                
                ctx.beginPath();
                ctx.fillStyle = meteor.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
                ctx.arc(meteor.x, meteor.y, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // 8. 主绘制与动画循环
        function draw() {
            ctx.fillStyle = config.bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            drawStars();
            drawMeteors();
        }
        
        function animate() {
            updateStars();
            updateMeteors();
            draw();
            requestAnimationFrame(animate);
        }
        
        // 9. 初始化启动
        initStars();
        
        setTimeout(() => {
            createMeteorBurst(1);
            scheduleNextMeteor();
            console.log('✨ 星空顶已加载完成！');
            console.log('🌟 特点：');
            console.log('   - 适中大小星星（0.15-1.0像素）');
            console.log('   - 明显忽明忽暗闪烁效果');
            console.log('   - 多种闪烁模式：正常闪烁、呼吸、忽明忽暗、快速闪烁');
            console.log('   - 鼠标移动时产生蓝色烟花，无停留光晕');
            console.log('   - 流星雨背景效果');
            console.log('📊 控制台输入 SimpleStarrySky 查看可用函数');
        }, 1000);
        
        animate();
        
        // 10. 全局控制API
        window.SimpleStarrySky = {
            setConfig: function(newConfig) {
                Object.assign(config, newConfig);
                initStars();
                if (meteorTimer) clearTimeout(meteorTimer);
                scheduleNextMeteor();
            },
            
            getStats: function() {
                const fadingStars = stars.filter(s => s.isFading).length;
                const flashingStars = stars.filter(s => s.isQuickFlashing).length;
                const totalFading = fadingStars + flashingStars;
                
                return {
                    stars: {
                        total: stars.length,
                        fading: fadingStars,
                        quickFlashing: flashingStars,
                        totalWithEffects: totalFading
                    },
                    meteors: meteors.length,
                    mouseMeteors: mouseMeteors.length,
                    mouseMoved: mouseMoved
                };
            },
            
            // 星星闪烁控制
            triggerFadeEffect: function(count = 10) {
                let triggered = 0;
                for (let i = 0; i < count; i++) {
                    const star = stars[Math.floor(Math.random() * stars.length)];
                    if (!star.isFading) {
                        star.isFading = true;
                        star.fadeInOut = Math.random() > 0.5;
                        star.fadeProgress = 0;
                        star.fadeTimer = 0;
                        star.fadeDuration = config.fadeInOutDurationRange[0] + Math.random() * (config.fadeInOutDurationRange[1] - config.fadeInOutDurationRange[0]);
                        triggered++;
                    }
                }
                console.log(`触发了 ${triggered} 颗星星的忽明忽暗效果`);
                return triggered;
            },
            
            triggerQuickFlash: function(count = 5) {
                let triggered = 0;
                for (let i = 0; i < count; i++) {
                    const star = stars[Math.floor(Math.random() * stars.length)];
                    if (!star.isQuickFlashing) {
                        star.isQuickFlashing = true;
                        star.quickFlashTimer = config.quickFlashDurationRange[0] + Math.random() * (config.quickFlashDurationRange[1] - config.quickFlashDurationRange[0]);
                        star.quickFlashIntensity = 0.7 + Math.random() * 0.3;
                        triggered++;
                    }
                }
                console.log(`触发了 ${triggered} 颗星星的快速闪烁效果`);
                return triggered;
            },
            
            setFadeIntensity: function(intensity) {
                config.fadeInOutChance = Math.max(0.001, Math.min(0.02, intensity));
                console.log(`忽明忽暗概率已设置为: ${config.fadeInOutChance}`);
            },
            
            setBrightnessRange: function(min, max) {
                config.minFadeBrightness = Math.max(0.01, Math.min(0.3, min));
                config.maxFadeBrightness = Math.max(min + 0.1, Math.min(1.0, max));
                console.log(`亮度范围已设置为: ${config.minFadeBrightness} - ${config.maxFadeBrightness}`);
            },
            
            // 流星控制
            triggerMeteorBurst: function(amount = 1) {
                createMeteorBurst(amount);
            },
            
            setRainIntensity: function(intensity) {
                config.meteorRainIntensity = Math.max(0.1, intensity);
                if (meteorTimer) clearTimeout(meteorTimer);
                scheduleNextMeteor();
            },
            
            // 清理
            clearAll: function() {
                meteors.length = 0;
                mouseMeteors.length = 0;
            },
            
            // 星星控制
            setStarCount: function(count) {
                config.starCount = Math.max(100, Math.min(1200, count));
                initStars();
                console.log(`星星数量已设置为: ${count}`);
            },
            
            setStarSize: function(minSize, maxSize) {
                config.starSizeRange = [
                    Math.max(0.1, Math.min(1.5, minSize)),
                    Math.max(minSize + 0.1, Math.min(2.5, maxSize))
                ];
                initStars();
                console.log(`星星大小范围已设置为: ${minSize} - ${maxSize}`);
            },
            
            // 鼠标效果控制
            toggleMouseEffect: function(enabled) {
                config.mouseMeteorEnabled = enabled;
                console.log(`鼠标烟花效果: ${enabled ? '启用' : '禁用'}`);
            },
            
            setMouseMeteorCount: function(count) {
                config.mouseMeteorCount = Math.max(0, Math.min(10, count));
                console.log(`鼠标烟花数量已设置为: ${count}`);
            },
            
            // 调试功能
            toggleStarDebug: function(starId) {
                if (starId >= 0 && starId < stars.length) {
                    stars[starId].debug = !stars[starId].debug;
                    console.log(`星星 ${starId} 调试模式: ${stars[starId].debug ? '开启' : '关闭'}`);
                }
            },
            
            findFadingStars: function() {
                const fadingStars = stars.filter(s => s.isFading);
                console.log(`当前有 ${fadingStars.length} 颗星星正在忽明忽暗`);
                return fadingStars.map(s => s.id);
            },
            
            // 显示当前配置
            showConfig: function() {
                const stats = this.getStats();
                
                console.log('=== 当前星空配置 ===');
                console.log('星星总数:', config.starCount);
                console.log('忽明忽暗的星星:', stats.stars.fading, '颗');
                console.log('快速闪烁的星星:', stats.stars.quickFlashing, '颗');
                console.log('星星大小范围:', config.starSizeRange);
                console.log('忽明忽暗概率:', config.fadeInOutChance);
                console.log('亮度范围:', config.minFadeBrightness, '-', config.maxFadeBrightness);
                console.log('闪烁幅度:', config.twinkleAmplitude);
                console.log('鼠标烟花:', config.mouseMeteorEnabled ? '启用' : '禁用');
                console.log('流星雨强度:', config.meteorRainIntensity);
                console.log('==================');
            }
        };
    }
})();
