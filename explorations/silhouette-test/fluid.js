// Particle fluid confined to an arbitrary SVG path (Clavet-style double density relaxation).
// Sim space = the path's own coordinate space ("figure units").

const SPACING = 11, H = 24, RHO0 = 3.2, K = 4, KNEAR = 1.2;
const SUB = 3, VMAX = 600, XSPH = 0.35;
const DAMP = 0.995, WALL_FRICTION = 0.62, MAX_DISP = H * 0.12;

function chamfer(zero, W, HH){
  const d = new Float32Array(W * HH);
  for(let i = 0; i < d.length; i++) d[i] = zero[i] ? 0 : 1e9;
  for(let y = 0; y < HH; y++) for(let x = 0; x < W; x++){
    const i = y * W + x; let v = d[i];
    if(x > 0) v = Math.min(v, d[i - 1] + 1);
    if(y > 0) v = Math.min(v, d[i - W] + 1);
    if(x > 0 && y > 0) v = Math.min(v, d[i - W - 1] + 1.4142);
    if(x < W - 1 && y > 0) v = Math.min(v, d[i - W + 1] + 1.4142);
    d[i] = v;
  }
  for(let y = HH - 1; y >= 0; y--) for(let x = W - 1; x >= 0; x--){
    const i = y * W + x; let v = d[i];
    if(x < W - 1) v = Math.min(v, d[i + 1] + 1);
    if(y < HH - 1) v = Math.min(v, d[i + W] + 1);
    if(x < W - 1 && y < HH - 1) v = Math.min(v, d[i + W + 1] + 1.4142);
    if(x > 0 && y < HH - 1) v = Math.min(v, d[i + W - 1] + 1.4142);
    d[i] = v;
  }
  return d;
}

export class Fluid {
  // pathD: SVG path in sim units. vw/vh: sim space size. res: mask pixels per sim unit.
  constructor(pathD, { vw = 240, vh = 480, res = 0.5, spawn = [120, 40] } = {}){
    this.vw = vw; this.vh = vh; this.res = res; this.spawn = spawn;
    this.mw = Math.round(vw * res); this.mh = Math.round(vh * res);

    const m = document.createElement("canvas");
    m.width = this.mw; m.height = this.mh;
    const mc = m.getContext("2d", { willReadFrequently: true });
    mc.setTransform(res, 0, 0, res, 0, 0);
    mc.fillStyle = "#fff";
    // fill each subpath on its own so opposite windings union instead of cancelling
    // (head, neck and torso overlap; a shared Path2D would punch holes at the neck)
    for(const sub of pathD.split(/(?=M)/)) if(sub.trim()) mc.fill(new Path2D(sub));
    const px = mc.getImageData(0, 0, this.mw, this.mh).data;

    const inside = new Uint8Array(this.mw * this.mh), outside = new Uint8Array(this.mw * this.mh);
    for(let i = 0; i < inside.length; i++){ const on = px[i * 4 + 3] > 128; inside[i] = on ? 1 : 0; outside[i] = on ? 0 : 1; }
    const dOut = chamfer(inside, this.mw, this.mh), dIn = chamfer(outside, this.mw, this.mh);
    this.sdf = new Float32Array(inside.length);
    for(let i = 0; i < inside.length; i++) this.sdf[i] = (dOut[i] - dIn[i]) / res; // sim units, <0 inside

    // interior seed points for filling, ordered bottom-up
    this.seeds = [];
    for(let y = vh - SPACING * 0.5; y > 0; y -= SPACING * 0.87){
      const row = [], off = (Math.round(y / SPACING) % 2) * SPACING * 0.5;
      for(let x = SPACING * 0.5 + off; x < vw; x += SPACING){
        if(this.sample(x, y) < -SPACING * 0.42) row.push([x, y]);
      }
      row.sort(() => Math.random() - 0.5);
      this.seeds.push(...row);
    }

    this.n = 0; this.cap = this.seeds.length + 220;
    this.x = new Float32Array(this.cap); this.y = new Float32Array(this.cap);
    this.vx = new Float32Array(this.cap); this.vy = new Float32Array(this.cap);
    this.px_ = new Float32Array(this.cap); this.py_ = new Float32Array(this.cap);
    this.avx = new Float32Array(this.cap); this.avy = new Float32Array(this.cap);
    this.nbI = new Int32Array(128); this.nbX = new Float32Array(128); this.nbY = new Float32Array(128); this.nbQ = new Float32Array(128);
    this.cell = H; this.cols = Math.ceil(vw / this.cell) + 4; this.rows = Math.ceil(vh / this.cell) + 4;
    this.heads = new Int32Array(this.cols * this.rows); this.next = new Int32Array(this.cap);

  }

  sample(x, y){ // bilinear SDF, sim units
    const fx = x * this.res, fy = y * this.res;
    let x0 = Math.floor(fx), y0 = Math.floor(fy);
    x0 = Math.max(0, Math.min(this.mw - 2, x0)); y0 = Math.max(0, Math.min(this.mh - 2, y0));
    const tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0));
    const s = this.sdf, w = this.mw, i = y0 * w + x0;
    return (s[i] * (1 - tx) + s[i + 1] * tx) * (1 - ty) + (s[i + w] * (1 - tx) + s[i + w + 1] * tx) * ty;
  }

  grad(x, y){
    const e = 2 / this.res;
    const gx = this.sample(x + e, y) - this.sample(x - e, y);
    const gy = this.sample(x, y + e) - this.sample(x, y - e);
    const l = Math.hypot(gx, gy) || 1;
    return [gx / l, gy / l];
  }

  setTarget(count, { pour = true, spawnAt = null } = {}){
    count = Math.max(0, Math.min(this.cap, Math.round(count)));
    if(count > this.n){
      for(let k = this.n; k < count; k++){
        if(pour){
          const sp = spawnAt || this.spawn;
          this.x[k] = sp[0] + (Math.random() - .5) * 16;
          this.y[k] = sp[1] + (Math.random() - .5) * 14;
          this.vx[k] = (Math.random() - .5) * 40; this.vy[k] = 90 + Math.random() * 60;
        } else {
          const s = this.seeds[k % this.seeds.length];
          this.x[k] = s[0] + (Math.random() - .5) * 2; this.y[k] = s[1];
          this.vx[k] = this.vy[k] = 0;
        }
      }
    } else if(count < this.n){
      // un-drinking removes liquid from the top, so the level stays a function of the count alone
      const idx = [];
      for(let i = 0; i < this.n; i++) idx.push(i);
      idx.sort((a, b) => this.y[a] - this.y[b]);
      const drop = new Uint8Array(this.n);
      for(let k = 0; k < this.n - count; k++) drop[idx[k]] = 1;
      let w = 0;
      for(let i = 0; i < this.n; i++){
        if(drop[i]) continue;
        if(w !== i){ this.x[w] = this.x[i]; this.y[w] = this.y[i]; this.vx[w] = this.vx[i]; this.vy[w] = this.vy[i]; }
        w++;
      }
    }
    this.n = count;
  }

  // particles per unit so `goal` units exactly fill the vessel
  calibrate(goal, overfill = 1.12){ this.perCup = Math.floor(this.seeds.length * overfill / goal); return this.perCup; }

  // y of the surface when `count` particles are at rest — for aligning UI to the fill
  levelFor(count){
    const k = Math.max(1, Math.min(this.seeds.length, Math.round(count)));
    return count <= 0 ? this.vh : this.seeds[k - 1][1];
  }

  // median of per-column tops — the visible waterline
  surfaceY(){
    if(!this.n) return this.vh;
    const cols = new Map();
    for(let i = 0; i < this.n; i++){
      const c = (this.x[i] / 12) | 0, v = cols.get(c);
      if(v === undefined || this.y[i] < v) cols.set(c, this.y[i]);
    }
    const a = [...cols.values()].sort((p, q) => p - q);
    return a[a.length >> 1];
  }

  // Nudge the volume by one particle per call so the waterline holds at targetY,
  // absorbing the slow drift of the packing density.
  regulate(targetY, tol = 3){
    if(this.n < 8) return;
    const surf = this.surfaceY();
    if(surf < targetY - tol){
      let hi = 0;
      for(let i = 1; i < this.n; i++) if(this.y[i] < this.y[hi]) hi = i;
      const last = this.n - 1;
      this.x[hi] = this.x[last]; this.y[hi] = this.y[last];
      this.vx[hi] = this.vx[last]; this.vy[hi] = this.vy[last];
      this.n--;
    } else if(surf > targetY + tol && this.n < this.cap){
      const s = this.seeds[(Math.random() * Math.min(24, this.seeds.length)) | 0];
      const k = this.n;
      this.x[k] = s[0] + (Math.random() - .5) * 4; this.y[k] = s[1];
      this.vx[k] = 0; this.vy[k] = 0;
      this.n++;
    }
  }

  settle(steps = 90){ for(let i = 0; i < steps; i++) this.step(1 / 60, 0, 1500); }

  impulse(strength){
    for(let i = 0; i < this.n; i++){
      this.vx[i] += (Math.random() - .5) * strength * 1.4;
      this.vy[i] -= Math.random() * strength;
    }
  }

  step(dt, gx, gy){
    if(!(dt > 0)) return;
    const h = dt / SUB;
    for(let s = 0; s < SUB; s++) this.substep(h, gx, gy);
  }

  substep(dt, gx, gy){
    const n = this.n, x = this.x, y = this.y, vx = this.vx, vy = this.vy;
    for(let i = 0; i < n; i++){
      vx[i] = (vx[i] + gx * dt) * DAMP; vy[i] = (vy[i] + gy * dt) * DAMP;
      this.px_[i] = x[i]; this.py_[i] = y[i];
      x[i] += vx[i] * dt; y[i] += vy[i] * dt;
    }

    const { cols, rows, cell, heads, next } = this;
    heads.fill(-1);
    for(let i = 0; i < n; i++){
      const cx = Math.max(0, Math.min(cols - 1, (x[i] / cell + 2) | 0));
      const cy = Math.max(0, Math.min(rows - 1, (y[i] / cell + 2) | 0));
      const c = cy * cols + cx; next[i] = heads[c]; heads[c] = i;
    }

    for(let i = 0; i < n; i++){
      let rho = 0, rhoN = 0, svx = 0, svy = 0, cnt = 0;
      const cx = Math.max(0, Math.min(cols - 1, (x[i] / cell + 2) | 0));
      const cy = Math.max(0, Math.min(rows - 1, (y[i] / cell + 2) | 0));
      const nbI = this.nbI, nbX = this.nbX, nbY = this.nbY, nbQ = this.nbQ;
      let nn = 0;
      for(let oy = -1; oy <= 1; oy++) for(let ox = -1; ox <= 1; ox++){
        const gxi = cx + ox, gyi = cy + oy;
        if(gxi < 0 || gyi < 0 || gxi >= cols || gyi >= rows) continue;
        for(let j = heads[gyi * cols + gxi]; j !== -1; j = next[j]){
          if(j === i) continue;
          const dx = x[j] - x[i], dy = y[j] - y[i], d2 = dx * dx + dy * dy;
          if(d2 >= H * H || d2 < 1e-8) continue;
          const d = Math.sqrt(d2), q = 1 - d / H;
          rho += q * q; rhoN += q * q * q;
          svx += vx[j]; svy += vy[j]; cnt++;
          if(nn < 128){ nbI[nn] = j; nbX[nn] = dx / d; nbY[nn] = dy / d; nbQ[nn] = q; nn++; }
        }
      }
      const P = Math.max(0, K * (rho - RHO0)), PN = KNEAR * rhoN; // no cohesion: keeps the free surface flat
      let ax = 0, ay = 0;
      for(let k = 0; k < nn; k++){
        const j = nbI[k], ux = nbX[k], uy = nbY[k], q = nbQ[k];
        let D = P * q + PN * q * q;
        if(D > MAX_DISP) D = MAX_DISP; else if(D < -MAX_DISP) D = -MAX_DISP;
        x[j] += ux * D * .5; y[j] += uy * D * .5;
        ax -= ux * D * .5; ay -= uy * D * .5;
      }
      x[i] += ax; y[i] += ay;
      this.avx[i] = cnt ? svx / cnt : vx[i]; this.avy[i] = cnt ? svy / cnt : vy[i];
    }

    const rad = SPACING * 0.34;
    for(let i = 0; i < n; i++){
      let d = this.sample(x[i], y[i]);
      if(d > -rad){
        const [nx, ny] = this.grad(x[i], y[i]);
        const push = d + rad;
        x[i] -= nx * push; y[i] -= ny * push;
        const vn = vx[i] * nx + vy[i] * ny;
        if(vn > 0){ vx[i] -= nx * vn * (1 + WALL_FRICTION); vy[i] -= ny * vn * (1 + WALL_FRICTION); }
      }
    }

    for(let i = 0; i < n; i++){
      let nvx = (x[i] - this.px_[i]) / dt, nvy = (y[i] - this.py_[i]) / dt;
      nvx += (this.avx[i] - nvx) * XSPH; nvy += (this.avy[i] - nvy) * XSPH;
      const sp = Math.hypot(nvx, nvy);
      if(sp > VMAX){ nvx = nvx / sp * VMAX; nvy = nvy / sp * VMAX; }
      vx[i] = nvx; vy[i] = nvy;
    }
  }

  // Draw particles as solid discs; host applies an SVG goo filter to fuse them.
  drawDiscs(ctx, color, r = SPACING * 0.8){
    ctx.fillStyle = color;
    ctx.beginPath();
    for(let i = 0; i < this.n; i++){
      ctx.moveTo(this.x[i] + r, this.y[i]);
      ctx.arc(this.x[i], this.y[i], r, 0, 6.28318);
    }
    ctx.fill();
  }

}
