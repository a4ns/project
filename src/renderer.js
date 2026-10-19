/* DOT-C: render-only Canvas view. State and input belong to CORE. */
(function () {
  'use strict';
  const TILE = 40;
  const COLOR = { A: '#65dfff', B: '#ffc978', C: '#c3a2ff' };
  const KEY = { A: 'J', B: 'K', C: 'L' };
  const FONT = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  function text(ctx, value, x, y, size, color, align, weight) {
    ctx.font = `${weight || 500} ${size}px ${FONT}`;
    ctx.fillStyle = color || '#eaf2ff';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), x, y);
  }
  function panel(ctx, x, y, w, h, fill, stroke) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1); }
  }
  function fit(ctx, value, width, size) {
    ctx.font = `500 ${size}px ${FONT}`;
    const source = String(value || '');
    if (ctx.measureText(source).width <= width) return source;
    let result = source;
    while (result && ctx.measureText(result + '…').width > width) result = result.slice(0, -1);
    return result + '…';
  }
  function time(seconds) {
    const n = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  }
  function circuitPills(ctx, circuits, y, center) {
    ['A', 'B', 'C'].forEach((id, i) => {
      const x = center - 240 + i * 164;
      const on = circuits[id] === 1;
      panel(ctx, x, y, 152, 42, on ? '#1c3043' : '#101d2f', COLOR[id]);
      text(ctx, `${KEY[id]}  /  ${id}`, x + 13, y + 21, 15, COLOR[id], 'left', 750);
      text(ctx, on ? '1 · ВКЛ' : '0 · ВЫКЛ', x + 139, y + 21, 12, '#eaf2ff', 'right');
    });
  }
  function board(ctx, s, width, height) {
    const level = s.level;
    if (!level || !Array.isArray(level.map) || !level.map.length) return;
    const ox = (width - level.map[0].length * TILE) / 2;
    const oy = (height - level.map.length * TILE) / 2;
    const c = s.circuits || level.circuits || {};
    ctx.save();
    ctx.translate(ox, oy);
    level.map.forEach((row, y) => Array.from(row).forEach((cell, x) => {
      const px = x * TILE, py = y * TILE;
      if (cell === '#') {
        panel(ctx, px + 1, py + 1, 38, 38, '#23374d', '#344c65');
        panel(ctx, px + 3, py + 3, 34, 3, '#45617c');
      } else {
        panel(ctx, px, py, TILE, TILE, (x + y) % 2 ? '#101e30' : '#122236');
        ctx.fillStyle = '#253950'; ctx.fillRect(px + 19, py + 19, 2, 2);
      }
    }));
    if (level.exit) {
      const x = level.exit.x * TILE, y = level.exit.y * TILE;
      panel(ctx, x + 4, y + 4, 32, 32, '#153f39', '#81f6c1');
      text(ctx, '↗', x + 20, y + 17, 23, '#9affd4', 'center', 800);
      text(ctx, 'EXIT', x + 20, y + 31, 8, '#c6ffe6', 'center', 750);
    }
    (level.traps || []).forEach(t => {
      const x = t.x * TILE, y = t.y * TILE, active = c[t.circuit] === t.activeWhen;
      panel(ctx, x + 3, y + 3, 34, 34, active ? '#522436' : '#172d38', active ? '#ff829d' : '#456775');
      if (active) {
        ctx.strokeStyle = '#ff829d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 8, y + 8); ctx.lineTo(x + 32, y + 32);
        ctx.moveTo(x + 32, y + 8); ctx.lineTo(x + 8, y + 32); ctx.stroke();
      }
      panel(ctx, x + 10, y + 11, 20, 18, '#142031');
      text(ctx, t.circuit + (active ? '!' : '·'), x + 20, y + 20, 12, COLOR[t.circuit], 'center', 800);
    });
    (level.doors || []).forEach(d => {
      const x = d.x * TILE, y = d.y * TILE, open = c[d.circuit] === d.openWhen;
      const color = COLOR[d.circuit] || '#ffffff';
      if (!open) panel(ctx, x + 4, y + 3, 32, 34, '#263b51', color);
      panel(ctx, x + 2, y + 2, 4, 36, color);
      panel(ctx, x + 34, y + 2, 4, 36, color);
      if (!open) { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 8, y + 30); ctx.lineTo(x + 32, y + 6); ctx.stroke(); }
      panel(ctx, x + 11, y + 12, 18, 17, '#101d2f');
      text(ctx, d.circuit, x + 20, y + 20, 13, color, 'center', 800);
    });
    if (s.player) {
      const x = s.player.x * TILE, y = s.player.y * TILE;
      const radius = (s.player.radius == null ? .25 : s.player.radius) * TILE;
      ctx.shadowColor = '#7de7ff'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#e4fbff'; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = '#56cced'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#133d54'; ctx.fillRect(x - 3, y - 3, 2, 2); ctx.fillRect(x + 2, y - 3, 2, 2);
    }
    ctx.restore();
  }
  function overlay(ctx, s, width, height) {
    panel(ctx, 0, 0, width, height, 'rgba(5, 12, 24, .92)');
    const cx = width / 2, cy = height / 2;
    const won = s.mode === 'won', paused = s.mode === 'paused';
    text(ctx, 'C O O P  /  C I R C U I T', cx, cy - 164, 14, '#65dfff', 'center', 750);
    text(ctx, won ? 'СИНХРОНИЗАЦИЯ!' : paused ? 'ПАУЗА' : 'ДВА ИГРОКА. ОДНА ЦЕЛЬ.', cx, cy - 110, won ? 38 : 34, '#f1f6ff', 'center', 850);
    text(ctx, won ? 'Все пять уровней пройдены вместе.' : paused ? 'Игра остановлена. Время не идёт.' : 'Один ведёт. Другой переключает контуры.', cx, cy - 65, 17, '#b8c9df', 'center');
    if (won) {
      text(ctx, `ВРЕМЯ  ${time(s.elapsedSeconds)}     /     СБРОСЫ  ${s.resets || 0}`, cx, cy + 1, 20, '#81f6c1', 'center', 700);
    } else {
      panel(ctx, cx - 288, cy - 20, 270, 80, '#112338', '#314860');
      panel(ctx, cx + 18, cy - 20, 270, 80, '#112338', '#314860');
      text(ctx, '01  ПИЛОТ', cx - 268, cy + 2, 12, '#65dfff', 'left', 750);
      text(ctx, 'W A S D  ·  движение', cx - 268, cy + 33, 18, '#eff5ff');
      text(ctx, '02  ОПЕРАТОР', cx + 38, cy + 2, 12, '#ffc978', 'left', 750);
      text(ctx, 'J / K / L  ·  A / B / C', cx + 38, cy + 33, 18, '#eff5ff');
      text(ctx, 'Меняйте контуры по пути. Опасная клетка сбрасывает уровень.', cx, cy + 87, 14, '#b8c9df', 'center');
    }
    panel(ctx, cx - 190, cy + 121, 380, 48, '#65dfff');
    text(ctx, paused ? 'ENTER  ·  ПРОДОЛЖИТЬ' : won ? 'ENTER  ·  НОВАЯ ИГРА' : 'ENTER  ·  НАЧАТЬ', cx, cy + 145, 16, '#081421', 'center', 850);
    text(ctx, 'R · сброс уровня     /     Потеря фокуса · пауза', cx, cy + 195, 13, '#96abc5', 'center');
  }
  function draw(ctx, snapshot) {
    if (!ctx || !snapshot) return;
    const width = ctx.canvas.width, height = ctx.canvas.height;
    ctx.save();
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const background = ctx.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, '#0a172a'); background.addColorStop(1, '#060d19');
      panel(ctx, 0, 0, width, height, background);
      board(ctx, snapshot, width, height);
      if (snapshot.mode === 'playing') {
        panel(ctx, 0, 0, width, 36, 'rgba(6, 13, 25, .96)');
        text(ctx, `COOP / ${String((snapshot.levelIndex || 0) + 1).padStart(2, '0')} / 05`, 18, 18, 13, '#65dfff', 'left', 750);
        text(ctx, fit(ctx, snapshot.level && snapshot.level.title, width - 520, 14), width / 2, 18, 14, '#eaf2ff', 'center', 700);
        text(ctx, `${time(snapshot.elapsedSeconds)}   ·   Сбросы ${snapshot.resets || 0}`, width - 18, 18, 13, '#b8c9df', 'right');
        // Full-size maps leave only their boundary walls for the compact HUD.
        const rows = snapshot.level && snapshot.level.map ? snapshot.level.map.length : 0;
        if (rows <= 11) circuitPills(ctx, snapshot.circuits || {}, 54, width / 2);
        else {
          ['A', 'B', 'C'].forEach((id, i) => text(ctx, `${KEY[id]}:${id}=${(snapshot.circuits || {})[id] || 0}`, 24 + i * 94, height - 17, 12, COLOR[id], 'left', 750));
        }
        panel(ctx, rows <= 11 ? 0 : 304, height - 34, rows <= 11 ? width : width - 304, 34, 'rgba(6, 13, 25, .96)');
        const hintWidth = rows <= 11 ? width - 180 : width - 470;
        text(ctx, fit(ctx, snapshot.level && snapshot.level.hint, hintWidth, 13), rows <= 11 ? 18 : 314, height - 17, 13, '#b8c9df');
        text(ctx, 'R · заново', width - 18, height - 17, 12, '#eaf2ff', 'right');
      } else overlay(ctx, snapshot, width, height);
    } finally { ctx.restore(); }
  }
  window.CoopView = Object.freeze({ draw });
}());
