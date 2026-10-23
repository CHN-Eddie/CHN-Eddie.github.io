/**
 * 星空背景 v6（2026-10-21 性能优化版）
 * 与 v5 视觉一致，但把每帧的工作量压到最低：
 *   1. 星点预先画进一张离屏画布，每帧只 drawImage 一次（原来每帧画 200+ 次）
 *   2. 只有约 1/4 的星参与闪烁，每帧单独叠画
 *   3. 鼠标光晕用预渲染贴图，不再每帧 createRadialGradient
 *   4. 帧率锁 40fps（肉眼无差别，CPU 省 1/3）
 *   5. DPR 上限 1.5；去掉 mix-blend-mode（整页合成很贵），星点本身是浅色，白底上自然看不见
 */
(function () {
  'use strict';

  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  function start() {
    var old = document.querySelector('.starry-sky-canvas');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var cv = document.createElement('canvas');
    cv.className = 'starry-sky-canvas';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'z-index:1;pointer-events:none;display:block';
    document.body.appendChild(cv);

    var ctx = cv.getContext('2d');
    var W = 0, H = 0, DPR = 1;
    var MAX_DPR = 1.5;
    var MIN_GAP = 24;                 // 40fps 上限

    var starLayer = null;             // 静态星点层
    var twinkles = [];                // 参与闪烁的少量星
    var meteors = [];
    var motes = [];
    var rings = [];
    var nextMeteorAt = 0;
    var rafId = 0, lastTs = 0, lastDraw = 0, visible = true;

    var pointer = { x: -999, y: -999, gx: -999, gy: -999, has: false, lastSpawn: 0, lx: -999, ly: -999 };

    var TINTS = ['#ffffff', '#e8f0ff', '#dde8ff'];
    var spriteCache = {};

    function rand(a, b) { return a + Math.random() * (b - a); }
    function rgba(hex, a) {
      var n = parseInt(hex.slice(1), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }

    // 星点/光点贴图：按颜色+尺寸缓存，绝不每帧新建
    function sprite(color, size) {
      var key = color + '|' + size;
      if (spriteCache[key]) return spriteCache[key];
      var s = Math.max(6, Math.ceil(size * 8));
      var c = document.createElement('canvas');
      c.width = c.height = s;
      var g = c.getContext('2d');
      var r = s / 2;
      var grd = g.createRadialGradient(r, r, 0, r, r, r);
      grd.addColorStop(0, rgba(color, 1));
      grd.addColorStop(0.22, rgba(color, 0.62));
      grd.addColorStop(0.55, rgba(color, 0.12));
      grd.addColorStop(1, rgba(color, 0));
      g.fillStyle = grd;
      g.beginPath();
      g.arc(r, r, r, 0, Math.PI * 2);
      g.fill();
      spriteCache[key] = c;
      return c;
    }

    /* ---------------- 星点：一次画进离屏层 ---------------- */
    function buildStars() {
      twinkles = [];
      starLayer = document.createElement('canvas');
      starLayer.width = cv.width;
      starLayer.height = cv.height;
      var g = starLayer.getContext('2d');
      g.setTransform(DPR, 0, 0, DPR, 0, 0);

      var total = Math.max(50, Math.min(200, Math.round(W * H / 11000)));
      for (var i = 0; i < total; i++) {
        var y = Math.pow(Math.random(), 1.7) * H * 0.72;
        var mag = Math.pow(Math.random(), 2.2);
        var size = 0.55 + mag * 1.05;
        var base = 0.14 + mag * 0.42;
        var color = TINTS[Math.floor(Math.random() * TINTS.length)];
        var x = Math.random() * W;
        var d = size * 8;

        if (Math.random() < 0.25 && mag > 0.35) {
          // 少量星位留空，交给闪烁层实时画
          twinkles.push({ x: x, y: y, size: size, base: base, amp: rand(0.3, 0.6) * base,
            speed: rand(0.4, 1.3), phase: Math.random() * Math.PI * 2, color: color });
        } else {
          g.globalAlpha = base;
          g.drawImage(sprite(color, size.toFixed(2)), x - d / 2, y - d / 2, d, d);
        }
      }
      g.globalAlpha = 1;
    }

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = Math.round(W * DPR);
      cv.height = Math.round(H * DPR);
      cv.style.width = W + 'px';
      cv.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      buildStars();
    }

    /* ---------------- 流星 ---------------- */
    function scheduleNext(now) {
      nextMeteorAt = now + (Math.random() < 0.3 ? rand(900, 2200) : rand(3000, 8000));
    }

    function spawnMeteor() {
      var fromLeft = Math.random() < 0.5;
      var ang = rand(16, 38) * Math.PI / 180;
      var speed = rand(1100, 1700);
      meteors.push({
        x: fromLeft ? rand(-0.05 * W, 0.55 * W) : rand(0.45 * W, 1.05 * W),
        y: rand(-30, H * 0.22),
        vx: (fromLeft ? 1 : -1) * Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        len: rand(120, 210),
        width: rand(0.9, 1.5),
        life: 0,
        maxLife: rand(0.6, 1.0)
      });
    }

    /* ---------------- 鼠标：拖尾 + 点击六芒星 ---------------- */
    function spawnTrail(x0, y0, x1, y1) {
      var dx = x1 - x0, dy = y1 - y0;
      var dist = Math.hypot(dx, dy);
      var n = Math.max(1, Math.min(5, Math.round(dist / 10)));
      for (var i = 0; i < n; i++) {
        var t = i / n;
        motes.push({
          x: x0 + dx * t + rand(-2.5, 2.5),
          y: y0 + dy * t + rand(-2.5, 2.5),
          vx: dx * 0.06 + rand(-9, 9),
          vy: dy * 0.06 + rand(-14, -2),
          life: 0,
          maxLife: rand(0.55, 1.05),
          size: rand(1.0, 1.9),
          color: Math.random() < 0.16 ? '#ffeccc' : '#e8f0ff'
        });
      }
      if (motes.length > 220) motes.splice(0, motes.length - 220);
    }

    function burst(x, y) {
      for (var i = 0; i < 20; i++) {
        var a = (Math.PI * 2 * i) / 20 + rand(-0.12, 0.12);
        var sp = rand(60, 165);
        motes.push({
          x: x, y: y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0,
          maxLife: rand(0.7, 1.3),
          size: rand(1.2, 2.3),
          color: Math.random() < 0.2 ? '#ffeccc' : '#eaf3ff'
        });
      }
      rings.push({ x: x, y: y, life: 0, maxLife: 0.7 });
      if (motes.length > 220) motes.splice(0, motes.length - 220);
    }

    function onMove(e) { pointer.x = e.clientX; pointer.y = e.clientY; pointer.has = true; }
    function onDown(e) { burst(e.clientX, e.clientY); }
    function onLeave() { pointer.has = false; }

    /* ---------------- 绘制 ---------------- */
    function drawMeteors(dt) {
      for (var i = meteors.length - 1; i >= 0; i--) {
        var m = meteors[i];
        m.life += dt;
        if (m.life >= m.maxLife) { meteors.splice(i, 1); continue; }
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        var p = m.life / m.maxLife;
        var fade = p < 0.12 ? p / 0.12 : Math.pow(1 - (p - 0.12) / 0.88, 1.6);
        if (fade <= 0) continue;
        var sp = Math.hypot(m.vx, m.vy);
        var tx = m.x - (m.vx / sp) * m.len;
        var ty = m.y - (m.vy / sp) * m.len;
        var grd = ctx.createLinearGradient(m.x, m.y, tx, ty);
        grd.addColorStop(0, 'rgba(255,255,255,' + (0.95 * fade) + ')');
        grd.addColorStop(0.2, 'rgba(226,238,255,' + (0.55 * fade) + ')');
        grd.addColorStop(0.6, 'rgba(196,216,255,' + (0.16 * fade) + ')');
        grd.addColorStop(1, 'rgba(180,205,255,0)');
        ctx.strokeStyle = grd;
        ctx.lineWidth = m.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.globalAlpha = 0.8 * fade;
        ctx.drawImage(sprite('#ffffff', '2.00'), m.x - 8, m.y - 8, 16, 16);
        ctx.globalAlpha = 1;
      }
    }

    function drawGlow(dt) {
      if (!pointer.has) return;
      pointer.gx += (pointer.x - pointer.gx) * Math.min(1, dt * 12);
      pointer.gy += (pointer.y - pointer.gy) * Math.min(1, dt * 12);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(sprite('#c9dcff', '14.00'), pointer.gx - 110, pointer.gy - 110, 220, 220);
      ctx.globalAlpha = 1;
    }

    function drawMotes(dt) {
      if (!motes.length && !rings.length) return;

      for (var i = motes.length - 1; i >= 0; i--) {
        var m = motes[i];
        m.life += dt;
        if (m.life >= m.maxLife) { motes.splice(i, 1); continue; }
        m.vy += 10 * dt;
        m.vx *= 0.985;
        m.vy *= 0.985;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        var t = m.life / m.maxLife;
        ctx.globalAlpha = Math.pow(1 - t, 1.6) * 0.9;
        var d = m.size * 8;
        ctx.drawImage(sprite(m.color, m.size.toFixed(2)), m.x - d / 2, m.y - d / 2, d, d);
      }

      // 六芒星
      for (var k = rings.length - 1; k >= 0; k--) {
        var r = rings[k];
        r.life += dt;
        if (r.life >= r.maxLife) { rings.splice(k, 1); continue; }
        var rt = r.life / r.maxLife;
        var R = 10 + rt * 40;
        var rot = -Math.PI / 2 + rt * 0.25;
        for (var pass = 0; pass < 2; pass++) {
          ctx.globalAlpha = (1 - rt) * (pass === 0 ? 0.16 : 0.5);
          ctx.strokeStyle = 'rgba(205,226,255,1)';
          ctx.lineWidth = pass === 0 ? 4 : 1;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          for (var tri = 0; tri < 2; tri++) {
            var off = rot + tri * Math.PI;
            for (var i2 = 0; i2 < 3; i2++) {
              var a = off + (Math.PI * 2 * i2) / 3;
              var px = r.x + Math.cos(a) * R;
              var py = r.y + Math.sin(a) * R;
              if (i2 === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
          }
          ctx.stroke();
        }
        ctx.globalAlpha = (1 - rt) * 0.85;
        for (var v = 0; v < 6; v++) {
          var va = rot + (Math.PI / 3) * v;
          var vx = r.x + Math.cos(va) * R;
          var vy = r.y + Math.sin(va) * R;
          var dd = 7 * (1 - rt * 0.5);
          ctx.drawImage(sprite('#eaf3ff', '1.10'), vx - dd / 2, vy - dd / 2, dd, dd);
        }
      }
      ctx.globalAlpha = 1;
    }

    function frame(ts) {
      if (!visible) { rafId = 0; return; }
      rafId = requestAnimationFrame(frame);

      if (lastDraw && ts - lastDraw < MIN_GAP) return;   // 锁 40fps
      var dt = lastDraw ? Math.min((ts - lastDraw) / 1000, 0.1) : 0.025;
      lastDraw = ts;

      ctx.clearRect(0, 0, W, H);

      // 静态星层一次画完
      if (starLayer) ctx.drawImage(starLayer, 0, 0, W, H);

      // 少量闪烁
      var t = ts / 1000;
      for (var i = 0; i < twinkles.length; i++) {
        var s = twinkles[i];
        var a = s.base + s.amp * Math.sin(t * s.speed + s.phase);
        if (a < 0.03) a = 0.03;
        ctx.globalAlpha = a;
        var d = s.size * 8;
        ctx.drawImage(sprite(s.color, s.size.toFixed(2)), s.x - d / 2, s.y - d / 2, d, d);
      }
      ctx.globalAlpha = 1;

      if (!nextMeteorAt) nextMeteorAt = ts + 1500;
      if (ts >= nextMeteorAt) { spawnMeteor(); scheduleNext(ts); }
      drawMeteors(dt);

      if (pointer.has) {
        var dx = pointer.x - pointer.lx, dy = pointer.y - pointer.ly;
        if (dx * dx + dy * dy > 12 && ts - pointer.lastSpawn > 14) {
          if (pointer.lx < -500) { pointer.lx = pointer.x; pointer.ly = pointer.y; }
          spawnTrail(pointer.lx, pointer.ly, pointer.x, pointer.y);
          pointer.lx = pointer.x;
          pointer.ly = pointer.y;
          pointer.lastSpawn = ts;
        }
      }
      drawGlow(dt);
      drawMotes(dt);
    }

    /* ---------------- 生命周期 ---------------- */
    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 250);
    });
    document.addEventListener('visibilitychange', function () {
      visible = !document.hidden;
      if (visible && !REDUCE && !rafId) { lastDraw = 0; rafId = requestAnimationFrame(frame); }
    });

    resize();

    if (!REDUCE) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerdown', onDown, { passive: true });
      window.addEventListener('pointerleave', onLeave, { passive: true });
      rafId = requestAnimationFrame(frame);
    } else {
      ctx.drawImage(starLayer, 0, 0, W, H);
    }
  }
})();
