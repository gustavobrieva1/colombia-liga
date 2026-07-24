// =============================================================================
// render.js  —  Dibujo en canvas 2D con perspectiva. No conoce reglas del
// juego; recibe un "escenario" (cámara, balón, estado del arquero, cosméticos)
// y lo pinta. El mismo renderer sirve para el POV de pateador y de arquero:
// sólo cambia la cámara (y en el POV de arquero se agregan los guantes).
// =============================================================================
import { WORLD } from './config.js';
import { project } from './engine.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = 0; this.H = 0; this.dpr = 1;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.W = this.canvas.width; this.H = this.canvas.height; this.dpr = dpr;
  }

  clear() {
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H);
  }

  // --- Fondo: cielo + césped con líneas en perspectiva. ---
  drawField(cam) {
    const { ctx, W, H } = this;
    // Horizonte = proyección de un punto de piso muy lejano.
    const far = project({ x: 0, y: 0, z: cam.dir > 0 ? cam.pos.z + 60 : cam.pos.z - 60 }, cam, W, H);
    const horizon = Math.max(0, Math.min(H * 0.62, far.onScreen ? far.y : H * 0.42));

    // Cielo.
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#0e1b34'); sky.addColorStop(1, '#274268');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon);

    // Césped.
    const grass = ctx.createLinearGradient(0, horizon, 0, H);
    grass.addColorStop(0, '#1f7a3a'); grass.addColorStop(1, '#0f5024');
    ctx.fillStyle = grass; ctx.fillRect(0, horizon, W, H - horizon);

    // Franjas de césped (bandas a distintos z).
    const dir = cam.dir;
    const zStart = dir > 0 ? -3 : WORLD.goalZ + 2;
    for (let i = 0; i < 22; i++) {
      const z = zStart + dir * i * 1.4;
      const a = project({ x: -30, y: 0, z }, cam, W, H);
      const b = project({ x: 30, y: 0, z: z + dir * 0.7 }, cam, W, H);
      if (!a.onScreen && !b.onScreen) continue;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)';
      const y0 = a.y, y1 = b.y;
      ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0) + 1);
    }

    // Punto de penal.
    this._groundEllipse(cam, { x: 0, y: 0, z: 0 }, 0.12, 'rgba(255,255,255,.85)');
    // Arco del área (semicírculo) y línea de área — sutil.
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 2 * this.dpr;
    this._groundLine(cam, { x: -20, y: 0, z: WORLD.goalZ }, { x: 20, y: 0, z: WORLD.goalZ });
    this._groundLine(cam, { x: -5.5, y: 0, z: WORLD.goalZ - 5.5 }, { x: -5.5, y: 0, z: WORLD.goalZ });
    this._groundLine(cam, { x: 5.5, y: 0, z: WORLD.goalZ - 5.5 }, { x: 5.5, y: 0, z: WORLD.goalZ });
    this._groundLine(cam, { x: -5.5, y: 0, z: WORLD.goalZ - 5.5 }, { x: 5.5, y: 0, z: WORLD.goalZ - 5.5 });
  }

  _groundLine(cam, p0, p1) {
    const { ctx, W, H } = this;
    const a = project(p0, cam, W, H), b = project(p1, cam, W, H);
    // Ambos extremos deben estar delante de la cámara: si uno queda detrás, su
    // proyección es basura y genera líneas cruzadas. Mejor no dibujar.
    if (!a.onScreen || !b.onScreen) return;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  _groundEllipse(cam, p, r, color) {
    const { ctx, W, H } = this;
    const c = project(p, cam, W, H);
    if (!c.onScreen) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, r * c.scale, r * c.scale * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Arco: postes, travesaño y red. ---
  drawGoal(cam) {
    const { ctx, W, H } = this;
    const hw = WORLD.goalWidth / 2, gh = WORLD.goalHeight, gz = WORLD.goalZ;
    const P = p => project(p, cam, W, H);
    const bl = P({ x: -hw, y: 0, z: gz }), tl = P({ x: -hw, y: gh, z: gz });
    const br = P({ x: hw, y: 0, z: gz }), tr = P({ x: hw, y: gh, z: gz });

    // Red (malla) en el plano del arco.
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = Math.max(1, 0.8 * this.dpr);
    const cols = 12, rows = 7;
    for (let i = 0; i <= cols; i++) {
      const f = i / cols;
      const a = P({ x: -hw + WORLD.goalWidth * f, y: 0, z: gz });
      const b = P({ x: -hw + WORLD.goalWidth * f, y: gh, z: gz });
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (let j = 0; j <= rows; j++) {
      const f = j / rows;
      const a = P({ x: -hw, y: gh * f, z: gz });
      const b = P({ x: hw, y: gh * f, z: gz });
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // Marco (postes + travesaño).
    ctx.strokeStyle = '#f2f6ff'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3 * this.dpr, 0.055 * (tr.scale + tl.scale));
    ctx.beginPath();
    ctx.moveTo(bl.x, bl.y); ctx.lineTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y); ctx.lineTo(br.x, br.y);
    ctx.stroke();
    return { bl, tl, br, tr };
  }

  // --- Marco del arco en el POV de arquero (screen-space, sutil): implica que
  //     estamos dentro del arco sin tapar la visión del campo. ---
  drawGoalFrameOverlay() {
    const { ctx, W, H } = this;
    const postW = Math.max(6 * this.dpr, W * 0.02);
    const inset = W * 0.045, top = H * 0.12;
    ctx.strokeStyle = 'rgba(242,246,255,0.92)'; ctx.lineCap = 'round'; ctx.lineWidth = postW;
    ctx.beginPath();
    ctx.moveTo(inset, H); ctx.lineTo(inset, top);
    ctx.lineTo(W - inset, top); ctx.lineTo(W - inset, H);
    ctx.stroke();
    // Malla sutil de la red hacia los bordes.
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1 * this.dpr;
    for (let i = 1; i < 6; i++) {
      const y = top + (H - top) * (i / 6);
      ctx.beginPath(); ctx.moveTo(inset, y); ctx.lineTo(W - inset, y); ctx.stroke();
    }
  }

  // --- Pateador NPC a lo lejos (POV arquero), parado cerca del punto penal. ---
  drawShooterFigure(cam, kitColor) {
    const { ctx, W, H } = this;
    const feet = project({ x: 0, y: 0, z: -0.2 }, cam, W, H);
    const head = project({ x: 0, y: 1.75, z: -0.2 }, cam, W, H);
    if (!feet.onScreen || feet.scale <= 0) return;
    const bodyW = 0.5 * feet.scale, bodyH = feet.y - head.y;
    if (bodyH <= 1) return;
    ctx.fillStyle = kitColor;
    roundRect(ctx, head.x - bodyW * 0.5, head.y + bodyH * 0.25, bodyW, bodyH * 0.75, bodyW * 0.3);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(head.x, head.y + bodyH * 0.14, bodyW * 0.5, 0, 7); ctx.fill();
  }

  // --- Zona objetivo resaltada en el plano del arco (retos de puntería). ---
  drawTargetZone(cam, zoneId) {
    const { ctx, W, H } = this;
    const hw = WORLD.goalWidth / 2, gh = WORLD.goalHeight, gz = WORLD.goalZ;
    const Z = {
      right_post: [hw * 0.5, hw, 0, gh],
      left_post:  [-hw, -hw * 0.5, 0, gh],
      top_right:  [hw * 0.4, hw, gh * 0.5, gh],
      top:        [-hw, hw, gh * 0.55, gh],
    }[zoneId];
    if (!Z) return;
    const [x0, x1, y0, y1] = Z;
    const P = p => project(p, cam, W, H);
    const c = [P({ x: x0, y: y0, z: gz }), P({ x: x1, y: y0, z: gz }),
               P({ x: x1, y: y1, z: gz }), P({ x: x0, y: y1, z: gz })];
    ctx.fillStyle = 'rgba(255,207,92,0.22)';
    ctx.strokeStyle = 'rgba(255,207,92,0.9)'; ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath(); ctx.moveTo(c[0].x, c[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(c[i].x, c[i].y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // --- Arquero visto de lejos (POV pateador). keeper: {x, y, dive, t} ---
  drawKeeperFigure(cam, keeper, kitColor) {
    const { ctx, W, H } = this;
    const gh = WORLD.goalHeight;
    // Posición base del arquero (centro del arco). dive desplaza en x/y.
    const kx = keeper.x, ky = 0;
    const feet = project({ x: kx, y: 0, z: WORLD.goalZ - 0.4 }, cam, W, H);
    const head = project({ x: kx, y: 1.75, z: WORLD.goalZ - 0.4 }, cam, W, H);
    if (!feet.onScreen) return;
    const s = feet.scale;
    const bodyW = 0.42 * s, bodyH = feet.y - head.y;

    // Brazos que se estiran según dive.x
    const reach = keeper.reach || 0;
    const armSpanPx = (0.5 + reach * 1.6) * bodyW * 2.1;
    ctx.strokeStyle = kitColor; ctx.lineCap = 'round';
    ctx.lineWidth = bodyW * 0.55;
    const shoulderY = head.y + bodyH * 0.32;
    const tilt = keeper.dive * 0.5;
    ctx.beginPath();
    ctx.moveTo(head.x - armSpanPx, shoulderY - tilt * armSpanPx * 0.5);
    ctx.lineTo(head.x + armSpanPx, shoulderY + tilt * armSpanPx * 0.5);
    ctx.stroke();
    // Guantes.
    ctx.fillStyle = '#ffe27a';
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(head.x + sgn * armSpanPx, shoulderY + sgn * tilt * armSpanPx * 0.5, bodyW * 0.42, 0, 7);
      ctx.fill();
    }
    // Torso.
    ctx.fillStyle = kitColor;
    roundRect(ctx, head.x - bodyW * 0.55, shoulderY, bodyW * 1.1, bodyH * 0.62, bodyW * 0.3);
    ctx.fill();
    // Cabeza.
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(head.x, head.y + bodyH * 0.12, bodyW * 0.5, 0, 7); ctx.fill();
  }

  // --- Guantes en primera persona (POV arquero). ---
  drawGloves(gloves) {
    const { ctx, W, H } = this;
    // gloves: {x:-1..1, y:0..1, ext:0..1}  x lateral, y altura, ext extensión
    const cx = W / 2 + gloves.x * W * 0.42;
    const cy = H * (0.92 - gloves.y * 0.55) - gloves.ext * H * 0.06;
    const r = W * 0.06;
    for (const sgn of [-1, 1]) {
      const gx = cx + sgn * (W * 0.11 + gloves.ext * W * 0.05);
      // Antebrazo desde el borde inferior.
      ctx.strokeStyle = '#20304f'; ctx.lineWidth = r * 1.1; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(W / 2 + sgn * W * 0.16, H + r);
      ctx.lineTo(gx, cy);
      ctx.stroke();
      // Guante.
      const grad = ctx.createRadialGradient(gx - r * 0.3, cy - r * 0.3, r * 0.2, gx, cy, r);
      grad.addColorStop(0, '#fff2a8'); grad.addColorStop(1, '#f0b400');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(gx, cy, r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2 * this.dpr;
      ctx.stroke();
    }
  }

  // --- Balón con sombra y rastro (visualiza la curva). ---
  drawBall(cam, ball, ballColor) {
    const { ctx, W, H } = this;
    // Sombra en el piso.
    const sh = project({ x: ball.pos.x, y: 0, z: ball.pos.z }, cam, W, H);
    if (sh.onScreen) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(sh.x, sh.y, WORLD.ballRadius * sh.scale * 1.1, WORLD.ballRadius * sh.scale * 0.45, 0, 0, 7);
      ctx.fill();
    }
    // Rastro.
    if (ball.trail.length > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = Math.max(1.5, 2 * this.dpr); ctx.lineCap = 'round';
      ctx.beginPath();
      let started = false;
      for (const p of ball.trail) {
        const q = project(p, cam, W, H);
        if (!q.onScreen) { started = false; continue; }
        if (!started) { ctx.moveTo(q.x, q.y); started = true; } else ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
    }
    // Balón.
    const c = project(ball.pos, cam, W, H);
    if (!c.onScreen) return;
    const r = Math.max(2, WORLD.ballRadius * c.scale);
    const grad = ctx.createRadialGradient(c.x - r * 0.35, c.y - r * 0.35, r * 0.2, c.x, c.y, r);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, ballColor);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7); ctx.fill();
    // Pentágonos simples.
    ctx.fillStyle = 'rgba(20,25,40,.85)';
    ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.28, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 1.2 * this.dpr; ctx.stroke();
  }

  // --- Guía del gesto (trazo en vivo) + medidores. ---
  drawSwipeGuide(samples) {
    if (!samples || samples.length < 2) return;
    const { ctx, dpr } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 4 * dpr; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(samples[0].x * dpr, samples[0].y * dpr);
    for (const s of samples) ctx.lineTo(s.x * dpr, s.y * dpr);
    ctx.stroke();
    // Punta.
    const last = samples[samples.length - 1];
    ctx.fillStyle = '#ffcf5c';
    ctx.beginPath(); ctx.arc(last.x * dpr, last.y * dpr, 8 * dpr, 0, 7); ctx.fill();
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
