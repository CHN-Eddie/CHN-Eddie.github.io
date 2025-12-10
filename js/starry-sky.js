/**
 * 终极版 - 交互式流星雨星座星空顶（最终修复版）
 * 功能：动态星座 + 流星雨 + 鼠标互动烟花
 */

(function() {
    'use strict';
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStarrySky);
    } else {
        initStarrySky();
    }
    
    function initStarrySky() {
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
        
        // 鼠标位置与烟花粒子
        let mouseX = -100, mouseY = -100;
        const fireworks = [];
        
        // ==================== 1. 主数据数组声明（最先声明）====================
        const stars = [];
        const meteors = [];
        const constellations = [];
        let meteorTimer = null;
        
        // ==================== 2. 配置参数声明 ====================
        const config = {
            // 基础星空
            starCount: 450,
            starSizeRange: [0.3, 2.2],
            twinkleSpeed: 0.03,
            
            // 流星雨
            meteorBaseInterval: [300, 1000],
            meteorRainIntensity: 1.2,
            meteorRainBurstChance: 0.18,
            meteorRainBurstAmount: [3, 10],
            meteorSpeedRange: [10, 28],
            meteorLengthRange: [80, 280],
            meteorWidthRange: [1.0, 3.2],
            meteorColorPalette: ['#A0D2FF', '#FFFFFF', '#FFD700', '#7FFFD4', '#FFB6C1'],
            
            // 星座
            showConstellations: true,
            constellationStarScale: 1.8,
            constellationLineWidth: 0.8,
            constellationLineColor: 'rgba(100, 150, 255, 0.4)',
            constellationStarColor: 'rgba(255, 255, 200, 0.9)',
            
            // 鼠标烟花
            fireworkParticleCount: 70,
            fireworkParticleSpeed: 2.5,
            fireworkParticleSizeRange: [1.0, 3.5],
            fireworkColors: [
                '#FF5555', '#FFAA55', '#FFFF55', '#55FF55',
                '#5555FF', '#AA55FF', '#FF55FF', '#55FFFF'
            ],
            fireworkDecay: 0.96,
            fireworkTrail: true
        };
        
        // ==================== 3. 星座数据库（修复：提前声明）====================
        const constellationDatabase = [
            ['大熊座（北斗七星）', 
             [[0.1,0.1],[0.13,0.15],[0.16,0.12],[0.19,0.17],[0.22,0.14],[0.25,0.19],[0.28,0.16]],
             [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]]],
            ['猎户座', 
             [[0.7,0.2],[0.75,0.25],[0.8,0.2],[0.75,0.3],[0.7,0.35],[0.8,0.35]],
             [[0,1],[1,2],[1,3],[3,4],[3,5]]],
            ['天鹰座（牛郎星）', 
             [[0.6,0.6],[0.62,0.65],[0.64,0.7],[0.58,0.68]],
             [[0,1],[1,2],[0,3]]],
            ['天琴座（织女星）', 
             [[0.3,0.25],[0.33,0.28],[0.28,0.3],[0.32,0.32]],
             [[0,1],[0,2],[0,3],[2,3]]],
            ['仙女座', 
             [[0.85,0.5],[0.88,0.55],[0.91,0.5],[0.94,0.55],[0.97,0.5]],
             [[0,1],[1,2],[2,3],[3,4]]]
        ];
        
        // ==================== 事件监听 ====================
        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            if (Math.random() > 0.7) {
                createFireworkBurst(mouseX, mouseY, 1, 3);
            }
        });
        
        document.addEventListener('click', (e) => {
            createFireworkBurst(e.clientX, e.clientY, 5, 15);
        });
        
        // ==================== 核心函数定义 ====================
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initConstellations();
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        function initConstellations() {
            constellations.length = 0;
            if (!config.showConstellations) return;
            
            for (const [name, points, lines] of constellationDatabase) {
                const canvasPoints = points.map(pt => ({
                    x: (pt[0] + (Math.random()-0.5)*0.03) * canvas.width,
                    y: (pt[1] + (Math.random()-0.5)*0.03) * canvas.height
                }));
                constellations.push({ name, points: canvasPoints, lines });
            }
        }
        
        function drawConstellations() {
            if (!config.showConstellations) return;
            
            for (const constellation of constellations) {
                ctx.beginPath();
                ctx.strokeStyle = config.constellationLineColor;
                ctx.lineWidth = config.constellationLineWidth;
                for (const [startIdx, endIdx] of constellation.lines) {
                    const start = constellation.points[startIdx];
                    const end = constellation.points[endIdx];
                    ctx.moveTo(start.x, start.y);
                    ctx.lineTo(end.x, end.y);
                }
                ctx.stroke();
                
                for (const point of constellation.points) {
                    ctx.beginPath();
                    ctx.fillStyle = config.constellationStarColor;
                    const pulse = 0.8 + 0.2 * Math.sin(Date.now() * 0.002 + point.x * 0.01);
                    ctx.arc(point.x, point.y, config.constellationStarScale * pulse, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        
        function updateStars() {
            for (const star of stars) {
                star.brightness += star.twinkleSpeed * star.twinkleDirection;
                if (star.brightness > 1) {
                    star.brightness = 1;
                    star.twinkleDirection = -1;
                } else if (star.brightness < 0.3) {
                    star.brightness = 0.3;
                    star.twinkleDirection = 1;
                }
            }
        }
        
        function initStars() {
            stars.length = 0;
            for (let i = 0; i < config.starCount; i++) {
                stars.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    size: config.starSizeRange[0] + Math.random() * (config.starSizeRange[1] - config.starSizeRange[0]),
                    brightness: 0.3 + Math.random() * 0.7,
                    twinkleSpeed: config.twinkleSpeed * (0.5 + Math.random()),
                    twinkleDirection: Math.random() > 0.5 ? 1 : -1
                });
            }
        }
        
        function drawStars() {
            for (const star of stars) {
                ctx.beginPath();
                const alpha = star.brightness;
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        function createMeteorBurst(amount) {
            for (let i = 0; i < amount; i++) {
                const centerX = Math.random() * canvas.width;
                const startX = centerX + (Math.random() - 0.5) * 200;
                const startY = -20 - Math.random() * 50;
                const angle = Math.PI / 3.5 + Math.random() * Math.PI / 4;
                const color = config.meteorColorPalette[
                    Math.floor(Math.random() * config.meteorColorPalette.length)
                ];
                
                meteors.push({
                    x: startX, y: startY,
                    vx: Math.sin(angle) * (config.meteorSpeedRange[0] + Math.random() * (config.meteorSpeedRange[1] - config.meteorSpeedRange[0])),
                    vy: Math.cos(angle) * (config.meteorSpeedRange[0] + Math.random() * (config.meteorSpeedRange[1] - config.meteorSpeedRange[0])),
                    length: config.meteorLengthRange[0] + Math.random() * (config.meteorLengthRange[1] - config.meteorLengthRange[0]),
                    width: config.meteorWidthRange[0] + Math.random() * (config.meteorWidthRange[1] - config.meteorWidthRange[0]),
                    life: 1.0, decay: 0.015 + Math.random() * 0.015,
                    color: color, trail: [], maxTrailPoints: 12
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
            for (let i = meteors.length - 1; i >= 0; i--) {
                const meteor = meteors[i];
                meteor.x += meteor.vx;
                meteor.y += meteor.vy;
                meteor.trail.unshift({ x: meteor.x, y: meteor.y });
                if (meteor.trail.length > meteor.maxTrailPoints) meteor.trail.pop();
                meteor.life -= meteor.decay;
                if (meteor.y > canvas.height + 100 || meteor.x < -100 || 
                    meteor.x > canvas.width + 100 || meteor.life <= 0) {
                    meteors.splice(i, 1);
                }
            }
        }
        
        function drawMeteors() {
            for (const meteor of meteors) {
                for (let i = 0; i < meteor.trail.length; i++) {
                    const point = meteor.trail[i];
                    const alpha = (meteor.life * (1 - i / meteor.trail.length)) * 0.9;
                    if (i === 0) {
                        ctx.beginPath();
                        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 1.2})`;
                        ctx.arc(point.x, point.y, meteor.width * 1.8, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    if (i < meteor.trail.length - 1) {
                        const nextPoint = meteor.trail[i + 1];
                        ctx.beginPath();
                        ctx.strokeStyle = meteor.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
                        ctx.lineWidth = meteor.width;
                        ctx.lineCap = 'round';
                        ctx.moveTo(point.x, point.y);
                        ctx.lineTo(nextPoint.x, nextPoint.y);
                        ctx.stroke();
                    }
                }
            }
        }
        
        function createFireworkBurst(x, y, minParticles, maxParticles) {
            const particleCount = minParticles + Math.floor(Math.random() * (maxParticles - minParticles));
            for (let i = 0; i < particleCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = config.fireworkParticleSpeed * (0.7 + Math.random() * 0.6);
                const color = config.fireworkColors[Math.floor(Math.random() * config.fireworkColors.length)];
                
                fireworks.push({
                    x, y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: config.fireworkParticleSizeRange[0] + Math.random() * (config.fireworkParticleSizeRange[1] - config.fireworkParticleSizeRange[0]),
                    color: color,
                    life: 1.0,
                    decay: 0.02 + Math.random() * 0.03,
                    trail: config.fireworkTrail ? [] : null,
                    maxTrailPoints: 8
                });
            }
        }
        
        function updateFireworks() {
            for (let i = fireworks.length - 1; i >= 0; i--) {
                const fw = fireworks[i];
                fw.x += fw.vx;
                fw.y += fw.vy;
                fw.vx *= 0.98;
                fw.vy *= 0.98;
                
                if (config.fireworkTrail && fw.trail !== null) {
                    fw.trail.unshift({ x: fw.x, y: fw.y });
                    if (fw.trail.length > fw.maxTrailPoints) fw.trail.pop();
                }
                
                fw.life -= fw.decay;
                if (fw.life <= 0) {
                    fireworks.splice(i, 1);
                }
            }
        }
        
        function drawFireworks() {
            if (mouseX > 0 && mouseY > 0 && mouseX < canvas.width && mouseY < canvas.height) {
                const gradient = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 25);
                gradient.addColorStop(0, 'rgba(255, 255, 200, 0.6)');
                gradient.addColorStop(0.5, 'rgba(255, 200, 100, 0.2)');
                gradient.addColorStop(1, 'rgba(255, 150, 50, 0)');
                ctx.beginPath();
                ctx.fillStyle = gradient;
                ctx.arc(mouseX, mouseY, 25, 0, Math.PI * 2);
                ctx.fill();
            }
            
            for (const fw of fireworks) {
                const alpha = fw.life;
                
                if (config.fireworkTrail && fw.trail && fw.trail.length > 1) {
                    ctx.beginPath();
                    ctx.moveTo(fw.trail[0].x, fw.trail[0].y);
                    for (let i = 1; i < fw.trail.length; i++) {
                        const trailAlpha = alpha * (1 - i / fw.trail.length) * 0.7;
                        ctx.strokeStyle = fw.color.replace(')', `, ${trailAlpha})`).replace('rgb', 'rgba');
                        ctx.lineWidth = fw.size * 0.7;
                        ctx.lineTo(fw.trail[i].x, fw.trail[i].y);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(fw.trail[i].x, fw.trail[i].y);
                    }
                }
                
                ctx.beginPath();
                ctx.fillStyle = fw.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
                ctx.arc(fw.x, fw.y, fw.size, 0, Math.PI * 2);
                ctx.fill();
                
                const glow = ctx.createRadialGradient(fw.x, fw.y, 0, fw.x, fw.y, fw.size * 3);
                glow.addColorStop(0, fw.color.replace(')', `, ${alpha*0.5})`).replace('rgb', 'rgba'));
                glow.addColorStop(1, fw.color.replace(')', `, 0)`).replace('rgb', 'rgba'));
                ctx.beginPath();
                ctx.fillStyle = glow;
                ctx.arc(fw.x, fw.y, fw.size * 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        function draw() {
            ctx.fillStyle = 'rgba(5, 5, 15, 0.13)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            drawStars();
            drawConstellations();
            drawMeteors();
            drawFireworks();
        }
        
        function animate() {
            updateStars();
            updateMeteors();
            updateFireworks();
            draw();
            requestAnimationFrame(animate);
        }
        
        // ==================== 初始化启动 ====================
        initStars();
        initConstellations();
        
        setTimeout(() => {
            createMeteorBurst(4);
            scheduleNextMeteor();
            console.log('🌌 终极交互式星空顶已加载！移动鼠标或点击页面体验效果。');
        }, 2000);
        
        animate();
        
        // ==================== 全局控制API ====================
        window.StarrySky = {
            setConfig: function(newConfig) {
                Object.assign(config, newConfig);
                initStars();
                initConstellations();
                if (meteorTimer) clearTimeout(meteorTimer);
                scheduleNextMeteor();
            },
            getStats: function() {
                return {
                    stars: stars.length,
                    meteors: meteors.length,
                    fireworks: fireworks.length,
                    constellations: constellations.length
                };
            },
            triggerMeteorBurst: function(amount = 5) {
                createMeteorBurst(amount);
            },
            triggerFireworkBurst: function(x, y, amount = 10) {
                createFireworkBurst(x || canvas.width/2, y || canvas.height/2, amount, amount);
            },
            toggleConstellations: function(show) {
                config.showConstellations = show !== undefined ? show : !config.showConstellations;
            },
            setRainIntensity: function(intensity) {
                config.meteorRainIntensity = Math.max(0.1, intensity);
                if (meteorTimer) clearTimeout(meteorTimer);
                scheduleNextMeteor();
            }
        };
    }
})();