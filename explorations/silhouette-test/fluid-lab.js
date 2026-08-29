// Parameterised particle fluid confined to an SVG path (Clavet double density relaxation
// + optional viscosity and cohesion). Every constant is a live per-instance knob so a lab
// page can tune feel while the sim runs. Sim space = the path's coordinate space.

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

export const DEFAULTS = {
  spacing: 6,        // rest distance between particles (sim units) — the grain
  hFactor: 2.2,      // interaction radius = spacing * hFactor
  rho0: 3.2,         // rest density
  k: 3.4,            // pressure stiffness
  knear: 1.1,        // near-pressure (anti-clumping)
  cohesion: 0,       // 0 = flat free surface, 1 = full surface tension / droplets
  visc: 0.06,        // radial viscosity (Clavet sigma)
  visc2: 0.0,        // quadratic viscosity (beta)
  xsph: 0.25,        // velocity smoothing toward neighbour average
  damp: 0.998,       // per-substep velocity decay
  wallFriction: 0.6, // tangential loss at walls (0 = slippery, 1 = sticky)
  sub: 2,            // substeps per frame
  vmax: 700,
  radiusFactor: 0.8  // draw radius = spacing * radiusFactor
};

export class Fluid {
  constructor(pathD, { vw = 240, vh = 480, res = 1.5, params = {} } = {}){
    this.vw = vw; this.vh = vh; this.res = res;
    this.p = { ...DEFAULTS, ...params };
    this.mw = Math.round(vw * res); this.mh = Math.round(vh * res);

    const m = document.createElement("canvas");
    m.width = this.mw; m.height = this.mh;
    const mc = m.getContext("2d", { willReadFrequently: true });
    mc.setTransform(res, 0, 0, res, 0, 0);
    mc.fillStyle = "#fff";
    for(const sub of pathD.split(/(?=M)/)) if(sub.trim()) mc.fill(new Path2D(sub));
    const px = mc.getImageData(0, 0, this.mw, this.mh).data;

    const inside = new Uint8Array(this.mw * this.mh), outside = new Uint8Array(this.mw * this.mh);
    for(let i = 0; i < inside.length; i++){ const on = px[i * 4 + 3] > 128; inside[i] = on ? 1 : 0; outside[i] = on ? 0 : 1; }
    const dOut = chamfer(inside, this.mw, this.mh), dIn = chamfer(outside, this.mw, this.mh);
    this.sdf = new Float32Array(inside.length);
    for(let i = 0; i < inside.length; i++) this.sdf[i] = (dOut[i] - dIn[i]) / res;

    // precomputed normalised gradient — the wall pass reads it instead of doing
    // four SDF samples per particle per pass
    const W = this.mw, HH = this.mh;
    this.gX = new Float32Array(W * HH); this.gY = new Float32Array(W * HH);
    for(let y = 0; y < HH; y++) for(let x = 0; x < W; x++){
      const i = y * W + x;
      const xl = x > 0 ? i - 1 : i, xr = x < W - 1 ? i + 1 : i;
      const yt = y > 0 ? i - W : i, yb = y < HH - 1 ? i + W : i;
      let gx = this.sdf[xr] - this.sdf[xl], gy = this.sdf[yb] - this.sdf[yt];
      const l = Math.hypot(gx, gy) || 1;
      this.gX[i] = gx / l; this.gY[i] = gy / l;
    }

    this.steps_ = 0;
    this.buildSeeds();

    // headroom: settled packing is denser than the seed lattice, so filling the
    // vessel to the crown needs more particles than there are seeds
    this.cap = Math.round(this.seeds.length * 1.8) + 64;
    this.n = 0;
    for(const key of ["x", "y", "vx", "vy", "px_", "py_", "avx", "avy"]) this[key] = new Float32Array(this.cap);
    this.nbI = new Int32Array(192); this.nbX = new Float32Array(192); this.nbY = new Float32Array(192); this.nbQ = new Float32Array(192);
    this.next = new Int32Array(this.cap);
    this.regrid();
  }

  buildSeeds(){
    // settled packing sits closer than the nominal spacing, so the seed lattice
    // (which defines capacity and fill fraction) is pitched to the real rest distance
    const S = this.p.spacing * 0.78, { vw, vh } = this;
    this.latticeStep = S * 0.87;
    this.seeds = [];
    for(let y = vh - S * 0.5; y > 0; y -= S * 0.87){
      const row = [], off = (Math.round(y / S) % 2) * S * 0.5;
      for(let x = S * 0.5 + off; x < vw; x += S){
        if(this.sample(x, y) < -S * 0.5) row.push([x, y]);
      }
      row.sort(() => Math.random() - 0.5);
      this.seeds.push(...row);
    }
  }

  regrid(){
    this.cell = Math.max(4, this.p.spacing * this.p.hFactor);
    this.cols = Math.ceil(this.vw / this.cell) + 4; this.rows = Math.ceil(this.vh / this.cell) + 4;
    this.heads = new Int32Array(this.cols * this.rows);
  }

  // change grain: rebuilds the seed lattice and refills to the same fraction
  setSpacing(s){
    if(Math.abs(s - this.p.spacing) < 1e-3) return;
    const frac = this.seeds.length ? this.n / this.seeds.length : 0;
    this.p.spacing = s;
    // precomputed normalised gradient — the wall pass reads it instead of doing
    // four SDF samples per particle per pass
    const W = this.mw, HH = this.mh;
    this.gX = new Float32Array(W * HH); this.gY = new Float32Array(W * HH);
    for(let y = 0; y < HH; y++) for(let x = 0; x < W; x++){
      const i = y * W + x;
      const xl = x > 0 ? i - 1 : i, xr = x < W - 1 ? i + 1 : i;
      const yt = y > 0 ? i - W : i, yb = y < HH - 1 ? i + W : i;
      let gx = this.sdf[xr] - this.sdf[xl], gy = this.sdf[yb] - this.sdf[yt];
      const l = Math.hypot(gx, gy) || 1;
      this.gX[i] = gx / l; this.gY[i] = gy / l;
    }

    this.steps_ = 0;
    this.buildSeeds();
    const cap = Math.round(this.seeds.length * 1.8) + 64;
    if(cap > this.cap){
      for(const key of ["x", "y", "vx", "vy", "px_", "py_", "avx", "avy"]){
        const a = new Float32Array(cap); a.set(this[key]); this[key] = a;
      }
      this.next = new Int32Array(cap); this.cap = cap;
    }
    this.regrid();
    this.setFill(frac);
  }

  set(params){
    const old = this.p.spacing, s = params.spacing;
    Object.assign(this.p, params);
    if(s != null && Math.abs(s - old) > 1e-3){ this.p.spacing = old; this.setSpacing(s); }
    else this.regrid();
  }

  sample(x, y){
    const fx = x * this.res, fy = y * this.res;
    let x0 = Math.floor(fx), y0 = Math.floor(fy);
    x0 = Math.max(0, Math.min(this.mw - 2, x0)); y0 = Math.max(0, Math.min(this.mh - 2, y0));
    const tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0));
    const s = this.sdf, w = this.mw, i = y0 * w + x0;
    return (s[i] * (1 - tx) + s[i + 1] * tx) * (1 - ty) + (s[i + w] * (1 - tx) + s[i + w + 1] * tx) * ty;
  }

  grad(x, y){
    const fx = x * this.res, fy = y * this.res;
    let x0 = Math.floor(fx), y0 = Math.floor(fy);
    x0 = Math.max(0, Math.min(this.mw - 2, x0)); y0 = Math.max(0, Math.min(this.mh - 2, y0));
    const tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0));
    const w = this.mw, i = y0 * w + x0, A = this.gX, B = this.gY;
    let gx = (A[i] * (1 - tx) + A[i + 1] * tx) * (1 - ty) + (A[i + w] * (1 - tx) + A[i + w + 1] * tx) * ty;
    let gy = (B[i] * (1 - tx) + B[i + 1] * tx) * (1 - ty) + (B[i + w] * (1 - tx) + B[i + w + 1] * tx) * ty;
    const l = Math.hypot(gx, gy) || 1;
    return [gx / l, gy / l];
  }

  // fraction 0..1 of the vessel, placed on the seed lattice bottom-up (no pour)
  setFill(frac){
    const count = Math.max(0, Math.min(this.seeds.length, Math.round(frac * this.seeds.length)));
    if(count > this.n){
      for(let k = this.n; k < count; k++){
        const s = this.seeds[k];
        this.x[k] = s[0] + (Math.random() - .5) * 1.5; this.y[k] = s[1];
        this.vx[k] = this.vy[k] = 0;
      }
    } else if(count < this.n){
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
    this.fillFrac = this.seeds.length ? count / this.seeds.length : 0;
  }

  // hold the visible waterline at targetY by nudging volume one particle at a time,
  // so models with different equilibrium densities stay comparable at the same fill
  // proportional volume correction: moves the waterline toward targetY in a few
  // calls instead of one particle at a time
  // Returns true once the waterline is within tol, so a caller can latch and stop
  // calling — running this every frame is what keeps a body of water stirring.
  regulate(targetY, tol = 3, maxStep = 24, injectAt = null){
    if(this.n < 8) return true;
    const surf = this.surfaceY(), err = surf - targetY; // >0 = too low
    if(Math.abs(err) < tol) return true;
    const rowH = this.latticeStep;
    const perRow = Math.max(1, this.seeds.length / (this.vh / rowH));
    let k = Math.round((Math.abs(err) / rowH) * perRow * 0.5);
    k = Math.max(1, Math.min(maxStep, k));
    if(err > 0){
      for(let i = 0; i < k && this.n < this.cap; i++){
        const j = this.n;
        if(injectAt){ // pour: falls in at the mouth instead of appearing at the floor
          this.x[j] = injectAt[0] + (Math.random() - .5) * 14;
          this.y[j] = injectAt[1] + (Math.random() - .5) * 10;
          this.vx[j] = (Math.random() - .5) * 30; this.vy[j] = 90 + Math.random() * 70;
        } else {
          const s = this.seeds[(Math.random() * Math.min(20, this.seeds.length)) | 0];
          this.x[j] = s[0] + (Math.random() - .5) * 3; this.y[j] = s[1];
          this.vx[j] = 0; this.vy[j] = 0;
        }
        this.n++;
      }
    } else {
      for(let i = 0; i < k && this.n > 8; i++){
        let hi = 0;
        for(let j = 1; j < this.n; j++) if(this.y[j] < this.y[hi]) hi = j;
        const last = this.n - 1;
        this.x[hi] = this.x[last]; this.y[hi] = this.y[last];
        this.vx[hi] = this.vx[last]; this.vy[hi] = this.vy[last];
        this.n--;
      }
    }
    return false;
  }

  // Pick the volume that rests at targetY, then leave it alone — a per-frame
  // regulator would keep stirring the body and never converge.
  calibrateFill(targetY, g = 1500){
    this.settle(40, g);
    const perRow = Math.max(1, Math.round(this.seeds.length / (this.vh / (this.latticeStep))));
    for(let it = 0; it < 45; it++){
      const surf = this.surfaceY(), err = surf - targetY; // >0 means too low
      if(Math.abs(err) < 1.5) break;
      const delta = Math.round((err / (this.latticeStep)) * perRow * 0.7);
      const want = Math.max(0, Math.min(this.seeds.length, this.n + delta));
      if(want === this.n) break;
      this.setCount(want);
      this.settle(14, g);
    }
    this.settle(30, g);
  }

  setCount(count){
    count = Math.max(0, Math.min(this.cap, Math.round(count)));
    if(count > this.n){
      for(let k = this.n; k < count; k++){
        const s = this.seeds[k % this.seeds.length];
        this.x[k] = s[0] + (Math.random() - .5) * 1.5; this.y[k] = s[1];
        this.vx[k] = this.vy[k] = 0;
      }
    } else if(count < this.n){
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

  settle(steps = 60, g = 1500){ for(let i = 0; i < steps; i++) this.step(1 / 60, 0, g); }

  impulse(strength){
    for(let i = 0; i < this.n; i++){
      this.vx[i] += (Math.random() - .5) * strength * 1.4;
      this.vy[i] -= Math.random() * strength;
    }
  }

  step(dt, gx, gy){
    if(!(dt > 0)) return;
    const base = Math.max(1, Math.round(this.p.sub));
    const sub = Math.max(base, Math.min(6, Math.round(base * 6 / this.p.spacing)));
    const h = dt / sub;
    for(let s = 0; s < sub; s++) this.substep(h, gx, gy);
    if((++this.steps_ & 3) === 0) this.recapture();
  }

  // any particle that still ends up outside the silhouette is put back on the
  // lowest free seed, so no volume is lost behind the clip path
  recapture(){
    const rad = this.p.spacing * 0.34;
    for(let i = 0; i < this.n; i++){
      let d = this.sample(this.x[i], this.y[i]);
      if(d <= 0) continue;
      for(let k = 0; k < 4 && d > -rad; k++){
        const [nx, ny] = this.grad(this.x[i], this.y[i]);
        this.x[i] -= nx * (d + rad); this.y[i] -= ny * (d + rad);
        d = this.sample(this.x[i], this.y[i]);
      }
      if(d > 0){ // still outside: put it back on the floor of the vessel
        const s = this.seeds[(Math.random() * Math.min(12, this.seeds.length)) | 0];
        this.x[i] = s[0]; this.y[i] = s[1];
      }
      this.vx[i] = 0; this.vy[i] = 0;
    }
  }

  substep(dt, gx, gy){
    const n = this.n, x = this.x, y = this.y, vx = this.vx, vy = this.vy, p = this.p;
    const H = p.spacing * p.hFactor, MAX_DISP = H * 0.2;
    const damp = p.damp;

    for(let i = 0; i < n; i++){
      vx[i] = (vx[i] + gx * dt) * damp; vy[i] = (vy[i] + gy * dt) * damp;
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

    const doVisc = p.visc > 0 || p.visc2 > 0;
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
          const d = Math.sqrt(d2), q = 1 - d / H, ux = dx / d, uy = dy / d;
          rho += q * q; rhoN += q * q * q;
          svx += vx[j]; svy += vy[j]; cnt++;
          if(doVisc && j > i){
            const u = (vx[i] - vx[j]) * ux + (vy[i] - vy[j]) * uy;
            if(u > 0){
              const I = dt * q * (p.visc * u + p.visc2 * u * u) * 0.5;
              vx[i] -= ux * I; vy[i] -= uy * I;
              vx[j] += ux * I; vy[j] += uy * I;
            }
          }
          if(nn < 192){ nbI[nn] = j; nbX[nn] = ux; nbY[nn] = uy; nbQ[nn] = q; nn++; }
        }
      }
      let P = p.k * (rho - p.rho0);
      if(P < 0) P *= p.cohesion; // cohesion 0 => pressure only pushes: flat surface
      const PN = p.knear * rhoN;
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

    const rad = p.spacing * 0.34, wf = p.wallFriction;
    for(let pass = 0; pass < 2; pass++){
      let moved = 0;
      for(let i = 0; i < n; i++){
        const d = this.sample(x[i], y[i]);
        if(d > -rad){
          const [nx, ny] = this.grad(x[i], y[i]);
          const push = d + rad;
          x[i] -= nx * push; y[i] -= ny * push;
          if(pass === 0){
            const vn = vx[i] * nx + vy[i] * ny;
            if(vn > 0){ vx[i] -= nx * vn * (1 + wf); vy[i] -= ny * vn * (1 + wf); }
          }
          moved++;
        }
      }
      if(!moved) break;
    }

    const xs = p.xsph, vmax = p.vmax;
    for(let i = 0; i < n; i++){
      let nvx = (x[i] - this.px_[i]) / dt, nvy = (y[i] - this.py_[i]) / dt;
      nvx += (this.avx[i] - nvx) * xs; nvy += (this.avy[i] - nvy) * xs;
      const sp = Math.hypot(nvx, nvy);
      if(sp > vmax){ nvx = nvx / sp * vmax; nvy = nvy / sp * vmax; }
      vx[i] = nvx; vy[i] = nvy;
    }
  }

  surfaceY(){
    if(!this.n) return this.vh;
    const cols = new Map();
    for(let i = 0; i < this.n; i++){
      const c = (this.x[i] / 12) | 0, v = cols.get(c);
      if(v === undefined || this.y[i] < v) cols.set(c, this.y[i]);
    }
    const a = [...cols.values()].sort((q, w) => q - w);
    return a[a.length >> 1];
  }

  drawDiscs(ctx, color){
    const r = this.p.spacing * this.p.radiusFactor;
    ctx.fillStyle = color;
    ctx.beginPath();
    for(let i = 0; i < this.n; i++){
      ctx.moveTo(this.x[i] + r, this.y[i]);
      ctx.arc(this.x[i], this.y[i], r, 0, 6.28318);
    }
    ctx.fill();
  }
}
