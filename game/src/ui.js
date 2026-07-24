// =============================================================================
// ui.js  —  Capa de pantallas (DOM) y HUD. Separada del canvas a propósito:
// los menús son HTML (accesible, fácil de iterar) y el juego es canvas. La UI
// sólo llama métodos del `game`; no conoce la física ni el render.
// =============================================================================
import { COSMETICS, STATS, MATCH } from './config.js';
import { CHALLENGES } from './challenges.js';

const $ = sel => document.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// ---------------- HUD (marcador, banners, toasts) ----------------
export class Hud {
  constructor() {
    this.scoreboard = $('#scoreboard');
    this.roleBanner = $('#role-banner');
    this.toastEl = $('#toast');
    this.hintEl = $('#gesture-hint');
    this.redEl = $('#score-red'); this.blueEl = $('#score-blue'); this.roundEl = $('#round-pill');
    this._toastTimer = null;
  }
  showScoreboard(on) { this.scoreboard.classList.toggle('hidden', !on); if (!on) this.role(null); }
  score(r, b, label) { this.redEl.textContent = r; this.blueEl.textContent = b; if (label) this.roundEl.textContent = label; }
  role(kind, text) {
    if (!kind) { this.roleBanner.classList.add('hidden'); return; }
    this.roleBanner.className = kind; this.roleBanner.classList.remove('hidden');
    this.roleBanner.textContent = text;
  }
  hint(text) {
    if (!text) { this.hintEl.classList.add('hidden'); return; }
    this.hintEl.classList.remove('hidden'); this.hintEl.textContent = text;
  }
  // Muestra un toast animado; resuelve cuando termina (para secuenciar el match).
  toast(main, sub, ms = 1000) {
    return new Promise(resolve => {
      clearTimeout(this._toastTimer);
      this.toastEl.innerHTML = `${main}${sub ? `<span class="sub">${sub}</span>` : ''}`;
      this.toastEl.classList.remove('hidden');
      // force reflow para reiniciar la animación
      void this.toastEl.offsetWidth;
      this.toastEl.classList.add('show');
      this._toastTimer = setTimeout(() => {
        this.toastEl.classList.remove('show');
        setTimeout(() => this.toastEl.classList.add('hidden'), 180);
        resolve();
      }, ms);
    });
  }
}

// ---------------- Pantallas (menús) ----------------
export class UI {
  constructor(game) { this.game = game; this.root = $('#ui'); }
  clear() { this.root.innerHTML = ''; this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); this.root.innerHTML = ''; }

  topbar() {
    const p = this.game.profile;
    const bar = el('div', 'topbar');
    const lg = p.league();
    bar.append(
      el('div', 'pill', `${lg.icon} <span class="rank-name">${lg.name}</span>`),
      el('div', 'pill', `🏆 ${p.trophies}`),
    );
    return bar;
  }

  menu() {
    this.clear();
    const p = this.game.profile;
    const s = el('div', 'screen');
    s.append(this.topbar());
    s.append(el('div', 'logo', 'PENAL <span class="accent">CL</span><span class="accent2">ASH</span>'));
    s.append(el('div', 'tagline', 'Prototipo v2 · pateá, atajá, subí de liga'));

    const play = el('button', 'btn red', `⚽ Jugar · Mejor de ${MATCH.rounds}`);
    play.onclick = () => this.game.playMatch();
    const chal = el('button', 'btn', '🎯 Retos offline');
    chal.onclick = () => this.challenges();
    const cos = el('button', 'btn ghost', '🎨 Cosméticos');
    cos.onclick = () => this.cosmetics();
    const stats = el('button', 'btn ghost', '📈 Mejoras (Stats)');
    stats.onclick = () => this.stats();
    s.append(play, chal, cos, stats);

    const next = p.nextLeague();
    if (next) s.append(el('div', 'center-note', `Faltan ${next.min - p.trophies} 🏆 para ${next.name}`));
    else s.append(el('div', 'center-note', '¡Estás en Champions! Jugás sólo por trofeos.'));
    this.root.append(s);
  }

  backBtn(to) { const b = el('button', 'back', '‹ Volver'); b.onclick = () => to(); return b; }

  // ---- Cosméticos (única monetización) ----
  cosmetics() {
    this.clear();
    const p = this.game.profile;
    const s = el('div', 'screen sheet');
    s.append(this.backBtn(() => this.menu()));
    s.append(el('div', 'logo', '🎨 Cosméticos'));
    s.append(el('div', 'tagline', 'Sólo estética. Cero pay-to-win.'));

    const slots = [
      ['kit', 'Uniforme', true], ['ball', 'Balón', true],
      ['hair', 'Peinado', false], ['kickStyle', 'Estilo de pateo', false],
      ['celebration', 'Celebración', false],
    ];
    for (const [slot, label, isColor] of slots) {
      const card = el('div', 'card');
      const grp = el('div', 'cos-group');
      grp.append(el('h3', null, label));
      const row = el('div', isColor ? 'swatches' : 'chiprow');
      for (const item of COSMETICS[slot]) {
        const sel = p.loadout()[slot] === item.id;
        if (isColor && item.color) {
          const sw = el('div', 'swatch' + (sel ? ' sel' : ''));
          sw.style.background = item.color; sw.title = item.name;
          sw.onclick = () => { p.setCosmetic(slot, item.id); this.cosmetics(); };
          row.append(sw);
        } else {
          const chip = el('div', 'chip' + (sel ? ' sel' : ''), item.name);
          chip.onclick = () => { p.setCosmetic(slot, item.id); this.cosmetics(); };
          row.append(chip);
        }
      }
      grp.append(row); card.append(grp); s.append(card);
    }
    this.root.append(s);
  }

  // ---- Stats con tope 3-de-5 (estilo Clash) ----
  stats() {
    this.clear();
    const p = this.game.profile;
    const s = el('div', 'screen sheet');
    s.append(this.backBtn(() => this.menu()));
    s.append(el('div', 'logo', '📈 Mejoras'));
    const maxed = p.maxedCount();
    s.append(el('div', 'tagline', `Podés maximizar sólo ${STATS.maxedCap} de ${STATS.defs.length} stats.`));
    const capNote = el('div', 'cap-note', `Máximas: ${maxed}/${STATS.maxedCap}`);
    s.append(capNote);

    const card = el('div', 'card');
    for (const d of STATS.defs) {
      const v = p.char().stats[d.key];
      const isMax = v >= STATS.maxPerStat;
      const line = el('div', 'stat-line' + (isMax ? '' : ''));
      line.append(el('div', 'name', d.name));
      const bar = el('div', 'bar'); const fill = el('span'); fill.style.width = `${(v / STATS.maxPerStat) * 100}%`;
      if (isMax) fill.style.background = 'linear-gradient(90deg,#ffcf5c,#ff7a3d)';
      bar.append(fill); line.append(bar);
      line.append(el('div', 'val', `${v}/${STATS.maxPerStat}`));
      const pm = el('div', 'pm');
      const minus = el('button', null, '−'); minus.disabled = v <= 0;
      minus.onclick = () => { p.decStat(d.key); this.stats(); };
      const plus = el('button', null, '+'); plus.disabled = !p.canIncrement(d.key);
      plus.onclick = () => { p.incStat(d.key); this.stats(); };
      pm.append(minus, plus); line.append(pm);
      card.append(line);
      card.append(el('div', 'meta', d.desc, ));
    }
    s.append(card);
    s.append(el('div', 'center-note', 'En el prototipo repartís puntos libremente para probar el tope. En producción se ganan jugando (nunca se compran).'));
    this.root.append(s);
  }

  // ---- Retos offline ----
  challenges() {
    this.clear();
    const p = this.game.profile;
    const s = el('div', 'screen sheet');
    s.append(this.backBtn(() => this.menu()));
    s.append(el('div', 'logo', '🎯 Retos'));
    s.append(el('div', 'tagline', `Monedas: 🪙 ${p.data.coins}`));
    for (const ch of CHALLENGES) {
      const done = p.challengeDone(ch.id);
      const item = el('div', 'challenge-item' + (done ? ' done' : ''));
      const left = el('div');
      left.append(el('div', null, `<b>${ch.name}</b>`));
      left.append(el('div', 'meta', `${ch.blurb} · 🪙 ${ch.reward}`));
      item.append(left);
      if (done) item.append(el('div', 'badge-done', '✓'));
      else { const go = el('button', 'go', 'Jugar'); go.onclick = () => this.game.playChallenge(ch); item.append(go); }
      s.append(item);
    }
    this.root.append(s);
  }

  // ---- Resultado de partido ----
  matchResult(sum) {
    this.clear();
    const s = el('div', 'screen');
    s.append(el('div', 'logo', sum.won ? '🏆 ¡GANASTE!' : '😖 Perdiste'));
    s.append(el('div', 'tagline', `RED ${sum.red} — ${sum.blue} BLUE`));
    const card = el('div', 'card');
    card.append(el('div', 'stat-line', `<div class="name">Goles</div><div class="val" style="width:auto">${sum.goalsScored} · +${sum.goalsScored * 6}🏆</div>`));
    card.append(el('div', 'stat-line', `<div class="name">Atajadas</div><div class="val" style="width:auto">${sum.savesMade} · +${sum.savesMade * 11}🏆 <b style="color:var(--good)">(¡valen más!)</b></div>`));
    card.append(el('div', 'hr'));
    card.append(el('div', 'stat-line', `<div class="name">Trofeos</div><div class="val" style="width:auto">${sum.delta >= 0 ? '+' : ''}${sum.delta} → 🏆 ${sum.trophies} · ${sum.league.icon} ${sum.league.name}</div>`));
    s.append(card);
    const again = el('button', 'btn red', '🔁 Revancha'); again.onclick = () => this.game.playMatch();
    const menu = el('button', 'btn ghost', 'Menú'); menu.onclick = () => this.menu();
    s.append(again, menu);
    this.root.append(s);
  }

  // ---- Resultado de reto ----
  challengeResult(sum) {
    this.clear();
    const s = el('div', 'screen');
    s.append(el('div', 'logo', sum.won ? '✅ ¡Reto superado!' : '❌ Casi'));
    s.append(el('div', 'tagline', `${sum.challenge.name}: ${sum.success}/${sum.need}`));
    if (sum.won && sum.reward) s.append(el('div', 'card', `Ganaste 🪙 ${sum.reward} · Total: 🪙 ${sum.coins}`));
    else if (sum.won) s.append(el('div', 'card', 'Ya lo habías completado antes.'));
    const retry = el('button', 'btn', 'Volver a retos'); retry.onclick = () => this.challenges();
    const menu = el('button', 'btn ghost', 'Menú'); menu.onclick = () => this.menu();
    s.append(retry, menu);
    this.root.append(s);
  }
}
