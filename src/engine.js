/* CIRCUIT core. No dependencies, network requests, or renderer-side state. */
(function (root) {
  'use strict';

  const WIDTH = 960;
  const HEIGHT = 640;
  const TILE_SIZE = 40;
  const PLAYER_RADIUS = 0.25;
  const PLAYER_SPEED = 3.2;
  const EPSILON = 1e-10;
  const CIRCUITS = ['A', 'B', 'C'];
  const MOVEMENT = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
  const ACTIONS = { KeyJ: 'A', KeyK: 'B', KeyL: 'C' };
  const HANDLED = new Set([...MOVEMENT, ...Object.keys(ACTIONS), 'Enter', 'KeyR']);

  function circleRectOverlap(x, y, radius, tx, ty) {
    const nearestX = Math.max(tx, Math.min(x, tx + 1));
    const nearestY = Math.max(ty, Math.min(y, ty + 1));
    const dx = x - nearestX;
    const dy = y - nearestY;
    return dx * dx + dy * dy < radius * radius - EPSILON;
  }

  function validateLevels(levels) {
    if (!Array.isArray(levels) || levels.length === 0) {
      throw new Error('CoopLevels must contain at least one level.');
    }
    const ids = new Set();
    levels.forEach(function (level, index) {
      const fail = function (message) { throw new Error('Level ' + (index + 1) + ': ' + message); };
      if (!level || typeof level.id !== 'string' || ids.has(level.id)) fail('a unique id is required.');
      ids.add(level.id);
      if (!Array.isArray(level.map) || level.map.length < 3 || level.map.length > 16) fail('invalid map height.');
      const width = typeof level.map[0] === 'string' ? level.map[0].length : 0;
      if (width < 3 || width > 24) fail('invalid map width.');
      if (level.map.some(row => typeof row !== 'string' || row.length !== width || /[^#.]/.test(row))) fail('invalid map rows.');
      if (level.map[0].includes('.') || level.map[level.map.length - 1].includes('.') ||
          level.map.some(row => row[0] !== '#' || row[width - 1] !== '#')) fail('map must be bounded by walls.');
      const onFloor = p => p && Number.isInteger(p.x) && Number.isInteger(p.y) &&
        level.map[p.y] && level.map[p.y][p.x] === '.';
      if (!onFloor(level.spawn) || !onFloor(level.exit)) fail('spawn and exit must be floor tiles.');
      if (level.spawn.x === level.exit.x && level.spawn.y === level.exit.y) fail('spawn and exit must differ.');
      if (!level.circuits || CIRCUITS.some(key => level.circuits[key] !== 0 && level.circuits[key] !== 1)) fail('invalid initial circuits.');
      if (!Array.isArray(level.doors) || !Array.isArray(level.traps)) fail('doors and traps must be arrays.');
      const occupied = new Set();
      [['doors', 'openWhen'], ['traps', 'activeWhen']].forEach(function (entry) {
        level[entry[0]].forEach(function (item) {
          if (!onFloor(item) || !CIRCUITS.includes(item.circuit) || (item[entry[1]] !== 0 && item[entry[1]] !== 1)) fail('invalid ' + entry[0] + ' entry.');
          const position = item.x + ',' + item.y;
          if (occupied.has(position)) fail('obstacles must not overlap.');
          occupied.add(position);
          if (item.x === level.spawn.x && item.y === level.spawn.y &&
              (entry[0] === 'doors' ? level.circuits[item.circuit] !== item.openWhen : level.circuits[item.circuit] === item.activeWhen)) fail('spawn must be safe.');
        });
      });
    });
    return true;
  }

  /** A deterministic, DOM-free simulation. All positions are measured in tiles. */
  function create(levels, options) {
    validateLevels(levels);
    options = options || {};
    const speed = Number.isFinite(options.speed) && options.speed > 0 ? options.speed : PLAYER_SPEED;
    const held = new Set();
    let mode = 'menu';
    let levelIndex = 0;
    let player;
    let circuits;
    let elapsedSeconds = 0;
    let resets = 0;

    function level() { return levels[levelIndex]; }
    function loadLevel(index) {
      levelIndex = index;
      const data = level();
      player = { x: data.spawn.x + 0.5, y: data.spawn.y + 0.5, radius: PLAYER_RADIUS };
      circuits = { A: data.circuits.A, B: data.circuits.B, C: data.circuits.C };
    }
    function snapshot() {
      return {
        mode: mode, levelIndex: levelIndex, level: level(),
        player: { x: player.x, y: player.y, radius: player.radius },
        circuits: { A: circuits.A, B: circuits.B, C: circuits.C },
        elapsedSeconds: elapsedSeconds, resets: resets
      };
    }
    function clearKeys() { held.clear(); }
    function newGame() {
      elapsedSeconds = 0;
      resets = 0;
      clearKeys();
      loadLevel(0);
      mode = 'playing';
      return snapshot();
    }
    function pause() {
      clearKeys();
      if (mode === 'playing') mode = 'paused';
      return snapshot();
    }
    function resume() {
      clearKeys();
      if (mode === 'paused') mode = 'playing';
      return snapshot();
    }
    function reset() {
      if (mode !== 'playing' && mode !== 'paused') return false;
      resets += 1;
      loadLevel(levelIndex);
      return true;
    }
    function isSolid(tx, ty) {
      const data = level();
      if (!data.map[ty] || data.map[ty][tx] !== '.') return true;
      return data.doors.some(door => door.x === tx && door.y === ty && circuits[door.circuit] !== door.openWhen);
    }
    function collidesAt(x, y) {
      for (let ty = Math.floor(y - player.radius); ty <= Math.floor(y + player.radius); ty += 1) {
        for (let tx = Math.floor(x - player.radius); tx <= Math.floor(x + player.radius); tx += 1) {
          if (isSolid(tx, ty) && circleRectOverlap(x, y, player.radius, tx, ty)) return true;
        }
      }
      return false;
    }
    function hasHazardOverlap() {
      return level().traps.some(trap => circuits[trap.circuit] === trap.activeWhen &&
        circleRectOverlap(player.x, player.y, player.radius, trap.x, trap.y));
    }
    function checkInteractions() {
      if (hasHazardOverlap()) {
        reset();
        return 'reset';
      }
      const exit = level().exit;
      if (Math.floor(player.x) === exit.x && Math.floor(player.y) === exit.y) {
        if (levelIndex === levels.length - 1) {
          mode = 'won';
          clearKeys();
          return 'won';
        }
        loadLevel(levelIndex + 1);
        return 'advance';
      }
      return null;
    }
    function toggle(circuit) {
      if (mode !== 'playing' || !CIRCUITS.includes(circuit)) return false;
      circuits[circuit] = circuits[circuit] ? 0 : 1;
      // A closing door is lethal even though ordinary movement cannot enter it.
      if (collidesAt(player.x, player.y) || hasHazardOverlap()) reset();
      return true;
    }
    function moveAxis(axis, distance) {
      if (distance === 0) return;
      const original = player[axis];
      const target = original + distance;
      const collision = value => collidesAt(axis === 'x' ? value : player.x, axis === 'y' ? value : player.y);
      if (!collision(target)) {
        player[axis] = target;
        return;
      }
      // Small swept steps prevent tunneling; bisection keeps contact smooth.
      let safe = 0;
      let blocked = 1;
      for (let i = 0; i < 22; i += 1) {
        const fraction = (safe + blocked) / 2;
        if (collision(original + distance * fraction)) blocked = fraction;
        else safe = fraction;
      }
      player[axis] = original + distance * safe;
    }
    function update(dt) {
      if (mode !== 'playing' || !Number.isFinite(dt) || dt <= 0) return snapshot();
      let dx = (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0);
      let dy = (held.has('KeyS') ? 1 : 0) - (held.has('KeyW') ? 1 : 0);
      const length = Math.hypot(dx, dy);
      if (length) { dx /= length; dy /= length; }
      const steps = length ? Math.max(1, Math.ceil(speed * dt / 0.08)) : 1;
      const subDt = dt / steps;
      for (let i = 0; i < steps; i += 1) {
        elapsedSeconds += subDt;
        moveAxis('x', dx * speed * subDt);
        moveAxis('y', dy * speed * subDt);
        const interaction = checkInteractions();
        if (interaction) {
          // The rest of this frame is active time unless the final exit froze it.
          if (interaction !== 'won') elapsedSeconds += (steps - i - 1) * subDt;
          break;
        }
      }
      return snapshot();
    }
    function keyDown(codeOrEvent, repeated) {
      const code = typeof codeOrEvent === 'string' ? codeOrEvent : codeOrEvent.code;
      const repeat = typeof codeOrEvent === 'string' ? !!repeated : !!codeOrEvent.repeat;
      if (!HANDLED.has(code)) return false;
      const fresh = !repeat && !held.has(code);
      if (MOVEMENT.has(code)) {
        if (mode === 'playing' && !repeat) held.add(code);
        return true;
      }
      if (!fresh) return true;
      held.add(code);
      if (code === 'Enter') {
        if (mode === 'menu' || mode === 'won') newGame();
        else if (mode === 'paused') resume();
      } else if (code === 'KeyR') reset();
      else if (ACTIONS[code]) toggle(ACTIONS[code]);
      return true;
    }
    function keyUp(codeOrEvent) {
      const code = typeof codeOrEvent === 'string' ? codeOrEvent : codeOrEvent.code;
      held.delete(code);
      return HANDLED.has(code);
    }
    loadLevel(0);
    return Object.freeze({
      snapshot: snapshot, getSnapshot: snapshot, update: update, step: update,
      keyDown: keyDown, keyUp: keyUp, clearKeys: clearKeys,
      start: newGame, newGame: newGame, pause: pause, resume: resume,
      reset: reset, toggle: toggle, isSolid: isSolid, collidesAt: collidesAt
    });
  }

  // Functional isolated-test fallback. The supplied CoopView always takes priority.
  function fallbackDraw(ctx, state) {
    const data = state.level;
    const offsetX = (WIDTH - data.map[0].length * TILE_SIZE) / 2;
    const offsetY = (HEIGHT - data.map.length * TILE_SIZE) / 2;
    ctx.fillStyle = '#0a1020';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    data.map.forEach(function (row, y) {
      Array.from(row).forEach(function (tile, x) {
        ctx.fillStyle = tile === '#' ? '#29334c' : '#121d31';
        ctx.fillRect(offsetX + x * TILE_SIZE, offsetY + y * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1);
      });
    });
    const tile = function (entity, color, label) {
      ctx.fillStyle = color;
      ctx.fillRect(offsetX + entity.x * TILE_SIZE + 3, offsetY + entity.y * TILE_SIZE + 3, 34, 34);
      if (label) {
        ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(label, offsetX + (entity.x + 0.5) * TILE_SIZE, offsetY + (entity.y + 0.65) * TILE_SIZE);
      }
    };
    tile(data.exit, '#187c61', '→');
    data.doors.forEach(door => tile(door, state.circuits[door.circuit] === door.openWhen ? '#234b48' : '#9562ce', door.circuit));
    data.traps.forEach(trap => tile(trap, state.circuits[trap.circuit] === trap.activeWhen ? '#d84667' : '#403344', '!'));
    ctx.beginPath();
    ctx.arc(offsetX + state.player.x * TILE_SIZE, offsetY + state.player.y * TILE_SIZE, state.player.radius * TILE_SIZE, 0, Math.PI * 2);
    ctx.fillStyle = '#8cf7df'; ctx.fill();
    ctx.textAlign = 'left'; ctx.font = '16px system-ui'; ctx.fillStyle = '#f1f5ff';
    ctx.fillText((state.levelIndex + 1) + '/' + 5 + '  ' + data.title, 22, 26);
    ctx.textAlign = 'right';
    ctx.fillText(state.elapsedSeconds.toFixed(1) + 's · resets ' + state.resets, WIDTH - 22, 26);
    ctx.textAlign = 'center';
    ctx.fillText('A ' + state.circuits.A + '    B ' + state.circuits.B + '    C ' + state.circuits.C, WIDTH / 2, HEIGHT - 20);
    if (state.mode !== 'playing') {
      ctx.fillStyle = 'rgba(6, 11, 23, .88)'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#f1f5ff'; ctx.font = 'bold 44px system-ui';
      ctx.fillText(state.mode === 'won' ? 'Circuit complete!' : state.mode === 'paused' ? 'Paused' : 'CIRCUIT', WIDTH / 2, HEIGHT / 2 - 40);
      ctx.font = '19px system-ui';
      ctx.fillText(state.mode === 'menu' ? 'Player 1: WASD · Player 2: J K L' : state.mode === 'won' ? state.elapsedSeconds.toFixed(1) + ' seconds · ' + state.resets + ' resets' : 'Time is frozen while you are away.', WIDTH / 2, HEIGHT / 2 + 8);
      ctx.fillText(state.mode === 'menu' ? 'Press Enter to start' : state.mode === 'paused' ? 'Press Enter to resume' : 'Press Enter for a new game', WIDTH / 2, HEIGHT / 2 + 52);
    }
  }

  const api = Object.freeze({
    create: create, createGame: create, validateLevels: validateLevels,
    circleRectOverlap: circleRectOverlap,
    constants: Object.freeze({ WIDTH: WIDTH, HEIGHT: HEIGHT, TILE_SIZE: TILE_SIZE, PLAYER_RADIUS: PLAYER_RADIUS, PLAYER_SPEED: PLAYER_SPEED })
  });
  root.CoopEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  function mount() {
    const canvas = root.document.getElementById('game');
    if (!canvas || root.CoopGame) return;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let game;
    try {
      if (!Array.isArray(root.CoopLevels) || root.CoopLevels.length !== 5) throw new Error('Expected five levels in src/levels.js.');
      game = create(root.CoopLevels);
    } catch (error) {
      ctx.fillStyle = '#0a1020'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
      ctx.fillText('Unable to start the game: ' + error.message, 30, HEIGHT / 2);
      root.console.error(error);
      return;
    }
    root.CoopGame = game;
    let rendererFailed = false;
    function draw() {
      const state = game.snapshot();
      ctx.save();
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (root.CoopView && typeof root.CoopView.draw === 'function' && !rendererFailed) root.CoopView.draw(ctx, state);
        else fallbackDraw(ctx, state);
      } catch (error) {
        rendererFailed = true;
        root.console.error('Renderer failed; using fallback.', error);
        ctx.restore(); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        fallbackDraw(ctx, state);
      } finally { ctx.restore(); }
    }
    let previous = null;
    const editable = target => target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    root.addEventListener('keydown', function (event) {
      if (editable(event.target) || event.ctrlKey || event.altKey || event.metaKey) return;
      const modeBefore = game.snapshot().mode;
      if (game.keyDown(event)) {
        event.preventDefault();
        // A background tab may not have produced a frame since it was paused.
        // Never charge that gap to a newly started or explicitly resumed game.
        if (modeBefore !== 'playing' && game.snapshot().mode === 'playing') previous = null;
        draw();
      }
    });
    root.addEventListener('keyup', function (event) {
      if (game.keyUp(event) && !editable(event.target)) event.preventDefault();
    });
    root.addEventListener('blur', function () { game.pause(); previous = null; draw(); });
    root.document.addEventListener('visibilitychange', function () {
      if (root.document.hidden) { game.pause(); previous = null; draw(); }
    });
    canvas.addEventListener('pointerdown', function () { canvas.focus({ preventScroll: true }); });
    function frame(now) {
      const dt = previous === null ? 0 : Math.max(0, (now - previous) / 1000);
      previous = now;
      game.update(dt);
      draw();
      root.requestAnimationFrame(frame);
    }
    draw();
    root.requestAnimationFrame(frame);
  }
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', mount, { once: true });
    else mount();
  }
}(typeof window !== 'undefined' ? window : globalThis));
