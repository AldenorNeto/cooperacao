(() => {
  const SEED = null;
  const DEFAULTS = {
    popSizeLambda: 49,
    sigma: 0.12,
    genSeconds: 20,
    stepsPerGen: 1200,
    speed: 2,
  };
  class RNG {
    constructor(seed = null) {
      if (seed == null) {
        this._useMath = true;
      } else {
        this._useMath = false;
        this._state = seed | 0;
      }
    }
    rand() {
      if (this._useMath) return Math.random();
      this._state = (1664525 * this._state + 1013904223) | 0;
      return (this._state >>> 0) / 4294967296;
    }
    int(max) {
      return Math.floor(this.rand() * max);
    }
    float(min, max) {
      return min + this.rand() * (max - min);
    }
    gaussian(mean = 0, sd = 1) {
      if (this._next != null) {
        const v = this._next;
        this._next = null;
        return mean + v * sd;
      }
      let u = 0,
        v = 0,
        s = 0;
      do {
        u = 2 * this.rand() - 1;
        v = 2 * this.rand() - 1;
        s = u * u + v * v;
      } while (s >= 1 || s == 0);
      const m = Math.sqrt((-2 * Math.log(s)) / s);
      this._next = v * m;
      return mean + u * m * sd;
    }
    choose(arr) {
      return arr[this.int(arr.length)];
    }
  }

  const cvs = document.getElementById("c"),
    ctx = cvs.getContext("2d");
  const btnStart = document.getElementById("btnStart"),
    btnStop = document.getElementById("btnStop"),
    btnNext = document.getElementById("btnNext"),
    btnReset = document.getElementById("btnReset"),
    btnSave = document.getElementById("btnSave"),
    btnLoad = document.getElementById("btnLoad"),
    champJson = document.getElementById("champJson"),
    champInfo = document.getElementById("champInfo"),
    genLabel = document.getElementById("gen"),
    bestLabel = document.getElementById("best"),
    bestdelLabel = document.getElementById("bestdel"),
    popSizeLbl = document.getElementById("popSizeLbl"),
    inpPop = document.getElementById("inpPop"),
    valPop = document.getElementById("valPop"),
    valPopTotal = document.getElementById("valPopTotal"),
    inpSigma = document.getElementById("inpSigma"),
    valSigma = document.getElementById("valSigma"),
    inpGenSec = document.getElementById("inpGenSec"),
    valGenSec = document.getElementById("valGenSec"),
    inpSteps = document.getElementById("inpSteps"),
    valSteps = document.getElementById("valSteps"),
    inpSpeed = document.getElementById("inpSpeed"),
    valSpeed = document.getElementById("valSpeed"),
    togSensors = document.getElementById("togSensors"),
    togTrails = document.getElementById("togTrails"),
    togPhero = document.getElementById("togPhero"),
    togDebug = document.getElementById("togDebug"),
    debugBox = document.getElementById("debugBox");

  let rng = new RNG(SEED);
  let SIM = null;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }
  function pointInRect(x, y, r) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
  function rectOverlap(a, b) {
    return !(
      a.x + a.w < b.x ||
      b.x + b.w < a.x ||
      a.y + a.h < b.y ||
      b.y + b.h < a.y
    );
  }
  function rectCircleOverlap(rect, circle) {
    const x = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
    const y = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
    return (
      (x - circle.x) * (x - circle.x) + (y - circle.y) * (y - circle.y) <=
      circle.r * circle.r
    );
  }
  function rayCircleIntersectT(rx, ry, dx, dy, cx, cy, cr) {
    const ox = rx - cx,
      oy = ry - cy;
    const a = dx * dx + dy * dy;
    const b = 2 * (ox * dx + oy * dy);
    const c = ox * ox + oy * oy - cr * cr;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const t1 = (-b - s) / (2 * a),
      t2 = (-b + s) / (2 * a);
    if (t1 >= 0) return t1;
    if (t2 >= 0) return t2;
    return null;
  }

  class World {
    constructor(w, h, cols = 64, rows = 48) {
      this.w = w;
      this.h = h;
      this.base = { x: w / 2, y: h / 2, r: 18 };
      this.stones = [];
      this.obstacles = [];
      this.pherCols = cols;
      this.pherRows = rows;
      this.pher = new Float32Array(cols * rows);
    }
    pherCell(x, y) {
      const cx = clamp(
          Math.floor((x / this.w) * this.pherCols),
          0,
          this.pherCols - 1
        ),
        cy = clamp(
          Math.floor((y / this.h) * this.pherRows),
          0,
          this.pherRows - 1
        );
      return cy * this.pherCols + cx;
    }
    addPher(x, y, val) {
      this.pher[this.pherCell(x, y)] = clamp(
        this.pher[this.pherCell(x, y)] + val,
        0,
        1
      );
    }
    decayPher(f) {
      for (let i = 0; i < this.pher.length; i++) this.pher[i] *= f;
    }
  }

  class Agent {
    constructor(x, y, angle = 0, genome = null) {
      this.x = x;
      this.y = y;
      this.a = angle;
      this.v = 0;
      this.state = "SEEK";
      this.carry = false;
      this.mineTimer = 0;
      this.depositTimer = 0;
      this.memory = { angle: 0, dist: 0 };
      this.delivered = 0;
      this.collisions = 0;
      this.age = 0;
      this.trail = [];
      this.fitness = 0;
      this.genome = genome;
      this.id = Math.floor(Math.random() * 1e9);
    }
    record() {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 60) this.trail.shift();
    }
  }

  class Genome {
    constructor(rng) {
      this.sensorAngles = new Float32Array(5);
      for (let i = 0; i < 5; i++)
        this.sensorAngles[i] = (i - 2) * 0.35 + rng.float(-0.15, 0.15);
      this.sensorRange = rng.float(80, 220);
      this.inputs = 18;
      this.outputs = 3;
      this.weights = new Float32Array(this.inputs * this.outputs);
      this.biases = new Float32Array(this.outputs);
      for (let i = 0; i < this.weights.length; i++)
        this.weights[i] = rng.gaussian(0, 0.8);
      for (let i = 0; i < this.biases.length; i++)
        this.biases[i] = rng.gaussian(0, 0.5);
    }
    clone() {
      const g = Object.create(Genome.prototype);
      g.sensorAngles = new Float32Array(this.sensorAngles);
      g.sensorRange = this.sensorRange;
      g.inputs = this.inputs;
      g.outputs = this.outputs;
      g.weights = new Float32Array(this.weights);
      g.biases = new Float32Array(this.biases);
      return g;
    }
    mutate(rng, sigma) {
      const g = this.clone();
      for (let i = 0; i < g.sensorAngles.length; i++)
        g.sensorAngles[i] += rng.gaussian(0, 1) * sigma * 0.6;
      g.sensorRange += rng.gaussian(0, 1) * sigma * 20;
      g.sensorRange = Math.max(30, g.sensorRange);
      for (let i = 0; i < g.weights.length; i++)
        g.weights[i] += rng.gaussian(0, 1) * sigma;
      for (let i = 0; i < g.biases.length; i++)
        g.biases[i] += rng.gaussian(0, 1) * sigma;
      return g;
    }
    feed(inputs) {
      let acc = 0,
        rot = 0,
        mine = 0;
      const N = this.inputs;
      for (let i = 0; i < N; i++) {
        const x = inputs[i];
        acc += x * this.weights[i];
        rot += x * this.weights[i + N];
        mine += x * this.weights[i + 2 * N];
      }
      acc += this.biases[0];
      rot += this.biases[1];
      mine += this.biases[2];
      acc = 1 / (1 + Math.exp(-acc));
      rot = Math.tanh(rot);
      mine = 1 / (1 + Math.exp(-mine));
      return [acc, rot, mine];
    }
    serialize() {
      return JSON.stringify({
        sensorAngles: Array.from(this.sensorAngles),
        sensorRange: this.sensorRange,
        weights: Array.from(this.weights),
        biases: Array.from(this.biases),
      });
    }
    static deserialize(json) {
      const o = JSON.parse(json);
      const g = Object.create(Genome.prototype);
      g.sensorAngles = new Float32Array(o.sensorAngles);
      g.sensorRange = o.sensorRange;
      g.inputs = 18;
      g.outputs = 3;
      g.weights = new Float32Array(o.weights);
      g.biases = new Float32Array(o.biases);
      return g;
    }
  }

  class Simulation {
    constructor(canvas, ctx) {
      this.canvas = canvas;
      this.ctx = ctx;
      this.phy_dt = 1;
      this.genSeconds = DEFAULTS.genSeconds;
      this.stepsPerGen = DEFAULTS.stepsPerGen;
      this.speed = DEFAULTS.speed;
      this.lambda = DEFAULTS.popSizeLambda;
      this.sigma = DEFAULTS.sigma;
      this.world = new World(canvas.width, canvas.height, 64, 48);
      this.champion = new Genome(rng);
      this.generation = 0;
      this.running = false;
      this.showSensors = true;
      this.showTrails = true;
      this.showPhero = true;
      this.debug = false;
      this.population = [];
      this.maxPopulation = 300;
      this.minPopulation = 50;
      this.genStepCount = 0;
      this.bestFitness = 0;
      this.bestDelivered = 0;
      this.sanityFailed = false;
    }
    initWorld() {
      const w = this.canvas.width,
        h = this.canvas.height;
      this.world = new World(w, h, 64, 48);
      this.world.base = {
        x: w * 0.12 + w * 0.76 * rng.rand(),
        y: h * 0.12 + h * 0.76 * rng.rand(),
        r: 18,
      };
      const oCount = 6 + rng.int(7);
      this.world.obstacles = [];
      for (let i = 0; i < oCount; i++) {
        let ow = 40 + rng.float(0, 120),
          oh = 30 + rng.float(0, 100);
        let ox,
          oy,
          tries = 0;
        do {
          ox = rng.float(0, w - ow);
          oy = rng.float(0, h - oh);
          tries++;
        } while (
          (rectCircleOverlap({ x: ox, y: oy, w: ow, h: oh }, this.world.base) ||
            this.world.obstacles.some((o) =>
              rectOverlap(o, { x: ox, y: oy, w: ow, h: oh })
            )) &&
          tries < 200
        );
        this.world.obstacles.push({ x: ox, y: oy, w: ow, h: oh });
      }
      this.regenStones(1 + Math.max(this.lambda, this.minPopulation));
      this.world.pher.fill(0);
      this.buildPopulation();
      this.genStepCount = 0;
      if (this.genSeconds)
        this.stepsPerGen = Math.max(50, Math.round(this.genSeconds * 60));
    }
    regenStones(minTotalQuantity) {
      const w = this.canvas.width,
        h = this.canvas.height;
      this.world.stones = [];
      const sCount = 5 + rng.int(8);
      for (let i = 0; i < sCount; i++) {
        const r = 10 + rng.float(0, 6);
        let x,
          y,
          tries = 0;
        do {
          x = rng.float(40, w - 40);
          y = rng.float(40, h - 40);
          tries++;
        } while (
          (dist(x, y, this.world.base.x, this.world.base.y) < 80 ||
            this.world.obstacles.some((o) =>
              rectCircleOverlap(o, { x, y, r })
            )) &&
          tries < 200
        );
        this.world.stones.push({ x, y, r, quantity: 1 + rng.int(3) });
      }
      let total = this.world.stones.reduce((s, sn) => s + sn.quantity, 0);
      let idx = 0;
      while (total <= minTotalQuantity) {
        this.world.stones[idx % this.world.stones.length].quantity += 1;
        total++;
        idx++;
      }
      for (const s of this.world.stones) {
        s.x += rng.float(-8, 8);
        s.y += rng.float(-8, 8);
        s.x = clamp(s.x, 30, w - 30);
        s.y = clamp(s.y, 30, h - 30);
      }
    }
    buildPopulation() {
      const lambda = clamp(
        this.lambda,
        this.minPopulation - 1,
        this.maxPopulation - 1
      );
      const popSize = 1 + lambda;
      this.population = [];
      const champAgent = new Agent(
        this.world.base.x + this.world.base.r + 6,
        this.world.base.y,
        rng.float(0, Math.PI * 2),
        this.champion.clone()
      );
      this.population.push(champAgent);
      for (let i = 1; i < popSize; i++) {
        const g = this.champion.mutate(rng, this.sigma);
        const a = new Agent(
          this.world.base.x + this.world.base.r + 6 + rng.float(-6, 6),
          this.world.base.y + rng.float(-6, 6),
          rng.float(0, Math.PI * 2),
          g
        );
        this.population.push(a);
      }
    }
    sanityCheck() {
      let fail = null;
      if (!this.population || this.population.length < 1)
        fail = "population missing";
      if (!this.world || !this.world.stones || this.world.stones.length < 1)
        fail = "no stones";
      if (
        !(
          this.world.base.x > 0 &&
          this.world.base.x < this.canvas.width &&
          this.world.base.y > 0 &&
          this.world.base.y < this.canvas.height
        )
      )
        fail = "base out of bounds";
      this.sanityFailed = !!fail;
      if (this.sanityFailed) drawRedText(this.ctx, fail);
      return !this.sanityFailed;
    }
    stepAll() {
      if (!this.sanityCheck()) return;
      const maxSpeed = 2.2;
      this.genStepCount++;
      for (const agent of this.population) {
        const info = this.stepAgent(agent, agent.genome, this.world, maxSpeed);
        if (info.justPicked) agent.fitness += 400;
        if (info.justDeposited) agent.fitness += 1200;
        // small encouragement for attempting the behaviors (not forcing them)
        if (info.attemptedMine) agent.fitness += 6; // tiny reward for trying to mine (discovers action)
        if (info.attemptedDeposit) agent.fitness += 3; // tiny reward for trying to deposit
        if (agent.carry) {
          const d = dist(
            agent.x,
            agent.y,
            this.world.base.x,
            this.world.base.y
          );
          const proxBonus =
            clamp(1 - d / Math.hypot(this.world.w, this.world.h), 0, 1) * 2.5;
          agent.fitness += proxBonus;
        } else {
          let nearest = Infinity;
          for (const s of this.world.stones)
            if (s.quantity > 0)
              nearest = Math.min(nearest, dist(agent.x, agent.y, s.x, s.y));
          if (nearest < Infinity)
            agent.fitness +=
              clamp(
                1 - nearest / Math.hypot(this.world.w, this.world.h),
                0,
                1
              ) * 0.8;
        }
        agent.fitness += 0.01;
        agent.age++;
        agent.record();
      }
      this.world.decayPher(0.985);
      if (this.genStepCount >= this.stepsPerGen) this.endGeneration();
    }
    stepAgent(agent, genome, world, maxSpeed) {
      const range = genome.sensorRange;
      const inputs = new Array(18).fill(0);
      let idx = 0;
      agent.lastSeen = { angle: null, dist: null };
      for (let si = 0; si < 5; si++) {
        const ang = agent.a + genome.sensorAngles[si];
        let tObstacle = Infinity;
        for (let t = 4; t <= range; t += 5) {
          const sx = agent.x + Math.cos(ang) * t,
            sy = agent.y + Math.sin(ang) * t;
          if (sx < 2 || sy < 2 || sx > world.w - 2 || sy > world.h - 2) {
            tObstacle = t;
            break;
          }
          for (const ob of world.obstacles) {
            if (pointInRect(sx, sy, ob)) {
              tObstacle = t;
              break;
            }
          }
          if (tObstacle < Infinity) break;
        }
        const prox =
          1 - clamp((tObstacle === Infinity ? range : tObstacle) / range, 0, 1);
        let stoneSig = 0,
          baseSig = 0;
        const dx = Math.cos(ang),
          dy = Math.sin(ang);
        let bestTs = Infinity,
          bestStone = null;
        for (const s of world.stones) {
          if (s.quantity > 0) {
            const ts = rayCircleIntersectT(
              agent.x,
              agent.y,
              dx,
              dy,
              s.x,
              s.y,
              s.r
            );
            if (
              ts != null &&
              ts >= 0 &&
              ts <= range &&
              ts < tObstacle &&
              ts < bestTs
            ) {
              bestTs = ts;
              bestStone = s;
            }
          }
        }
        if (bestStone) {
          stoneSig = 1 - bestTs / range;
          agent.lastSeen.angle =
            Math.atan2(bestStone.y - agent.y, bestStone.x - agent.x) - agent.a;
          agent.lastSeen.dist = clamp(
            dist(agent.x, agent.y, bestStone.x, bestStone.y) /
              Math.hypot(world.w, world.h),
            0,
            1
          );
        }
        const tb = rayCircleIntersectT(
          agent.x,
          agent.y,
          dx,
          dy,
          world.base.x,
          world.base.y,
          world.base.r
        );
        if (tb != null && tb >= 0 && tb <= range && tb < tObstacle) {
          baseSig = 1 - tb / range;
          agent.lastSeen.angle =
            Math.atan2(world.base.y - agent.y, world.base.x - agent.x) -
            agent.a;
          agent.lastSeen.dist = clamp(
            dist(agent.x, agent.y, world.base.x, world.base.y) /
              Math.hypot(world.w, world.h),
            0,
            1
          );
        }
        inputs[idx++] = prox;
        inputs[idx++] = stoneSig;
        inputs[idx++] = baseSig;
      }
      inputs[idx++] = world.pher[world.pherCell(agent.x, agent.y)] || 0;
      const mem_angle_norm =
        agent.lastSeen.angle == null
          ? 0
          : clamp(agent.lastSeen.angle / Math.PI, -1, 1);
      const mem_dist_norm =
        agent.lastSeen.dist == null ? 0 : clamp(1 - agent.lastSeen.dist, 0, 1);
      inputs[idx++] = mem_angle_norm;
      inputs[idx++] = mem_dist_norm;
      const [acc, rot, mineOut] = genome.feed(inputs);
      let justPicked = false,
        justDeposited = false,
        attemptedMine = false,
        attemptedDeposit = false;
      // mining/deposit are actions that must be chosen by agent (mineOut). They are not automatic.
      // If agent chooses mineOut>0.6 near stone => begin mining (long). If chooses mineOut>0.6 at base while carrying => deposit (short).
      if (agent.state === "MINING") {
        agent.v *= 0.05;
        agent.mineTimer--;
        if (agent.mineTimer <= 0) {
          for (const s of world.stones) {
            if (s.quantity > 0 && dist(agent.x, agent.y, s.x, s.y) < s.r + 12) {
              s.quantity = Math.max(0, s.quantity - 1);
              agent.carry = true;
              agent.state = "RETURN";
              justPicked = true;
              break;
            }
          }
          if (agent.state === "MINING") agent.state = "SEEK";
        }
      } else if (agent.state === "DEPOSIT") {
        agent.v *= 0.05;
        agent.depositTimer--;
        if (agent.depositTimer <= 0) {
          if (
            agent.carry &&
            dist(agent.x, agent.y, world.base.x, world.base.y) <
              world.base.r + 14
          ) {
            agent.delivered++;
            agent.carry = false;
            agent.state = "SEEK";
            justDeposited = true;
          } else agent.state = "SEEK";
        }
      } else {
        agent.v = agent.v * 0.6 + acc * maxSpeed * 0.9;
        agent.a += rot * 0.12;
        agent.x += Math.cos(agent.a) * agent.v * this.phy_dt;
        agent.y += Math.sin(agent.a) * agent.v * this.phy_dt;
        // detect nearby stone/base for deciding whether mineOut is an attempt
        let nearStone = null;
        for (const s of world.stones) {
          if (s.quantity > 0 && dist(agent.x, agent.y, s.x, s.y) < s.r + 12) {
            nearStone = s;
            break;
          }
        }
        const nearBase =
          dist(agent.x, agent.y, world.base.x, world.base.y) <
          world.base.r + 14;
        if (mineOut > 0.6) {
          if (nearStone && agent.state === "SEEK") {
            attemptedMine = true;
            agent.state = "MINING";
            agent.mineTimer =
              40 + Math.floor(Math.abs(rng.gaussian(0, 1)) * 80);
          } else if (nearBase && agent.carry) {
            attemptedDeposit = true;
            agent.state = "DEPOSIT";
            agent.depositTimer =
              8 + Math.floor(Math.abs(rng.gaussian(0, 1)) * 10);
          } else {
            // agent attempted in wrong context — still small exploration credit (handled in stepAll)
            if (nearStone) attemptedMine = true;
            if (nearBase && agent.carry) attemptedDeposit = true;
          }
        }
      }
      if (agent.x < 2) {
        agent.x = 2;
        agent.v *= -0.2;
        agent.collisions++;
        agent.fitness -= 6;
      }
      if (agent.y < 2) {
        agent.y = 2;
        agent.v *= -0.2;
        agent.collisions++;
        agent.fitness -= 6;
      }
      if (agent.x > world.w - 2) {
        agent.x = world.w - 2;
        agent.v *= -0.2;
        agent.collisions++;
        agent.fitness -= 6;
      }
      if (agent.y > world.h - 2) {
        agent.y = world.h - 2;
        agent.v *= -0.2;
        agent.collisions++;
        agent.fitness -= 6;
      }
      for (const ob of world.obstacles) {
        if (pointInRect(agent.x, agent.y, ob)) {
          const cx = ob.x + ob.w / 2,
            cy = ob.y + ob.h / 2;
          const dx = agent.x - cx,
            dy = agent.y - cy;
          const ax = Math.abs(dx),
            ay = Math.abs(dy);
          if (ax > ay) agent.x += (dx > 0 ? 1 : -1) * 4;
          else agent.y += (dy > 0 ? 1 : -1) * 4;
          agent.collisions++;
          agent.fitness -= 8;
        }
      }
      if (agent.carry) {
        world.addPher(agent.x, agent.y, 0.02);
      }
      agent.a += (rng.rand() - 0.5) * 0.002;
      return {
        inputs,
        outputs: [acc, rot, mineOut],
        justPicked,
        justDeposited,
        attemptedMine,
        attemptedDeposit,
      };
    }
    endGeneration() {
      for (const a of this.population) if (a.carry) a.fitness += 40;
      let best = this.population[0];
      for (const a of this.population) if (a.fitness > best.fitness) best = a;
      this.champion = best.genome.clone();
      this.bestFitness = Math.round(best.fitness * 100) / 100;
      this.bestDelivered = best.delivered;
      this.generation++;
      this.regenStones(this.population.length + 2);
      this.buildPopulation();
      this.genStepCount = 0;
    }
    exportChampion() {
      return this.champion.serialize();
    }
    importChampion(json) {
      try {
        this.champion = Genome.deserialize(json);
        return true;
      } catch (e) {
        return false;
      }
    }
  }

  function drawRedText(ctx, msg) {
    ctx.save();
    ctx.fillStyle = "rgba(200,30,30,0.95)";
    ctx.font = "22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(msg, ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.restore();
  }

  function draw(world, pop, sim) {
    const ctx = sim.ctx,
      cvs = sim.canvas;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    if (sim.showPhero) {
      const cols = world.pherCols,
        rows = world.pherRows;
      const cw = cvs.width / cols,
        ch = cvs.height / rows;
      ctx.globalCompositeOperation = "lighter";
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          const v = world.pher[y * cols + x];
          if (v > 0.001) {
            ctx.fillStyle = `rgba(20,120,220,${v * 0.18})`;
            ctx.fillRect(x * cw, y * ch, cw, ch);
          }
        }
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.fillStyle = "#2b2f37";
    for (const ob of world.obstacles) ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
    for (const s of world.stones) {
      ctx.beginPath();
      ctx.fillStyle = s.quantity > 0 ? "#a9a089" : "#444";
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#111";
      ctx.stroke();
      ctx.fillStyle = "#dff";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.quantity.toString(), s.x, s.y);
    }
    ctx.beginPath();
    ctx.fillStyle = "#fff1a8";
    ctx.strokeStyle = "#d9b24a";
    ctx.arc(world.base.x, world.base.y, world.base.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (sim.showTrails) {
      ctx.lineWidth = 1;
      for (const a of pop) {
        if (a.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(a.trail[0].x, a.trail[0].y);
          for (let i = 1; i < a.trail.length; i++)
            ctx.lineTo(a.trail[i].x, a.trail[i].y);
          ctx.strokeStyle = "rgba(255,255,255,0.03)";
          ctx.stroke();
        }
      }
    }
    for (const a of pop) {
      if (sim.showSensors) drawSensors(ctx, a, a.genome, world);
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.a);
      let col = a.carry ? "#2fd28f" : "#58a6ff";
      if (a.state === "MINING") col = "#ff9a4d";
      if (a.state === "DEPOSIT") col = "#ffd56b";
      ctx.beginPath();
      ctx.fillStyle = col;
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(5, 0);
      ctx.lineTo(9, 0);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
    if (pop[0]) {
      ctx.beginPath();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.arc(pop[0].x, pop[0].y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.save();
    ctx.fillStyle = "rgba(2,6,10,0.35)";
    ctx.fillRect(8, 8, 340, 96);
    ctx.fillStyle = "#cfe7ff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Gen: ${sim.generation}`, 14, 26);
    ctx.fillText(`Best fit: ${sim.bestFitness}`, 14, 44);
    ctx.fillText(`Delivered: ${sim.bestDelivered}`, 14, 62);
    ctx.fillText(`Steps: ${sim.genStepCount}/${sim.stepsPerGen}`, 14, 80);
    ctx.fillText(`Pop: ${sim.population.length}`, 200, 80);
    ctx.restore();
  }

  function drawSensors(ctx, agent, genome, world) {
    const range = genome.sensorRange;
    for (let si = 0; si < 5; si++) {
      const ang = agent.a + genome.sensorAngles[si];
      let tObstacle = Infinity;
      for (let t = 4; t <= range; t += 6) {
        const sx = agent.x + Math.cos(ang) * t,
          sy = agent.y + Math.sin(ang) * t;
        if (sx < 2 || sy < 2 || sx > world.w - 2 || sy > world.h - 2) {
          tObstacle = t;
          break;
        }
        for (const ob of world.obstacles) {
          if (pointInRect(sx, sy, ob)) {
            tObstacle = t;
            break;
          }
        }
        if (tObstacle < Infinity) break;
      }
      let tStone = Infinity,
        tBase = Infinity;
      for (const s of world.stones)
        if (s.quantity > 0) {
          const ts = rayCircleIntersectT(
            agent.x,
            agent.y,
            Math.cos(ang),
            Math.sin(ang),
            s.x,
            s.y,
            s.r
          );
          if (ts != null && ts >= 0 && ts <= range && ts < tObstacle)
            tStone = Math.min(tStone, ts);
        }
      const tb = rayCircleIntersectT(
        agent.x,
        agent.y,
        Math.cos(ang),
        Math.sin(ang),
        world.base.x,
        world.base.y,
        world.base.r
      );
      if (tb != null && tb >= 0 && tb <= range && tb < tObstacle) tBase = tb;
      const tEnd = Math.min(tObstacle, tStone, tBase, range);
      ctx.beginPath();
      ctx.moveTo(agent.x, agent.y);
      ctx.lineTo(
        agent.x + Math.cos(ang) * tEnd,
        agent.y + Math.sin(ang) * tEnd
      );
      ctx.strokeStyle =
        tStone <= tEnd
          ? "#ffd89b"
          : tBase <= tEnd
          ? "#bdf7c7"
          : "rgba(200,220,255,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();
      if (tStone <= tEnd) {
        ctx.beginPath();
        ctx.fillStyle = "#ffb86b";
        ctx.arc(
          agent.x + Math.cos(ang) * tStone,
          agent.y + Math.sin(ang) * tStone,
          2.8,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      if (tBase <= tEnd) {
        ctx.beginPath();
        ctx.fillStyle = "#8effb5";
        ctx.arc(
          agent.x + Math.cos(ang) * tBase,
          agent.y + Math.sin(ang) * tBase,
          2.8,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  }

  function setup() {
    resizeCanvas();
    SIM = new Simulation(cvs, ctx);
    SIM.lambda = DEFAULTS.popSizeLambda;
    SIM.sigma = DEFAULTS.sigma;
    SIM.genSeconds = DEFAULTS.genSeconds;
    SIM.stepsPerGen = DEFAULTS.stepsPerGen;
    SIM.speed = DEFAULTS.speed;
    inpPop.min = "49";
    inpPop.max = "299";
    inpPop.value = String(SIM.lambda);
    inpSigma.value = String(SIM.sigma);
    inpGenSec.value = String(SIM.genSeconds);
    inpSteps.value = String(SIM.stepsPerGen);
    inpSpeed.value = String(SIM.speed);
    setUIFromSim();
    SIM.initWorld();
    SIM.sanityCheck();
    attachEvents();
    requestAnimationFrame(loop);
  }

  function resizeCanvas() {
    const rect = cvs.getBoundingClientRect();
    const ratio = devicePixelRatio || 1;
    cvs.width = Math.max(640, Math.floor((window.innerWidth - 420) * ratio));
    cvs.height = Math.max(420, Math.floor(window.innerHeight * ratio));
    cvs.style.width = window.innerWidth - 420 + "px";
    cvs.style.height = window.innerHeight + "px";
  }

  function attachEvents() {
    window.addEventListener("resize", () => {
      resizeCanvas();
      SIM.initWorld();
    });
    cvs.addEventListener("click", (e) => {
      const r = cvs.getBoundingClientRect();
      const x = (e.clientX - r.left) * (cvs.width / r.width),
        y = (e.clientY - r.top) * (cvs.height / r.height);
      SIM.world.base.x = x;
      SIM.world.base.y = y;
      SIM.initWorld();
    });
    btnReset.addEventListener("click", () => {
      rng = new RNG(SEED);
      SIM = new Simulation(cvs, ctx);
      SIM.lambda = parseInt(inpPop.value);
      SIM.sigma = parseFloat(inpSigma.value);
      SIM.genSeconds = parseInt(inpGenSec.value);
      SIM.stepsPerGen = Math.max(100, Math.round(SIM.genSeconds * 60));
      SIM.speed = parseInt(inpSpeed.value);
      SIM.initWorld();
      setUIFromSim();
    });
    btnStart.addEventListener("click", () => {
      SIM.running = true;
    });
    btnStop.addEventListener("click", () => {
      SIM.running = false;
    });
    btnNext.addEventListener("click", () => {
      if (!SIM.sanityCheck()) return;
      SIM.endGeneration();
      setUIFromSim();
    });
    btnSave.addEventListener("click", () => {
      const js = SIM.exportChampion();
      champJson.value = js;
      champInfo.innerText = js.slice(0, 800);
    });
    btnLoad.addEventListener("click", () => {
      if (champJson.value.trim().length > 10) {
        const ok = SIM.importChampion(champJson.value.trim());
        if (ok) alert("Champion loaded");
        else alert("Falha ao carregar");
      }
    });
    inpPop.addEventListener("input", () => {
      valPop.innerText = String(parseInt(inpPop.value));
      SIM.lambda = parseInt(inpPop.value);
      valPopTotal.innerText = String(1 + SIM.lambda);
      popSizeLbl.innerText = String(1 + SIM.lambda);
    });
    inpSigma.addEventListener("input", () => {
      valSigma.innerText = parseFloat(inpSigma.value).toFixed(2);
      SIM.sigma = parseFloat(inpSigma.value);
    });
    inpGenSec.addEventListener("input", () => {
      valGenSec.innerText = inpGenSec.value;
      SIM.genSeconds = parseInt(inpGenSec.value);
      SIM.stepsPerGen = Math.max(50, Math.round(SIM.genSeconds * 60));
      inpSteps.value = String(SIM.stepsPerGen);
      valSteps.innerText = String(SIM.stepsPerGen);
    });
    inpSteps.addEventListener("input", () => {
      valSteps.innerText = inpSteps.value;
      SIM.stepsPerGen = parseInt(inpSteps.value);
      const secs = Math.max(1, Math.round(SIM.stepsPerGen / 60));
      SIM.genSeconds = secs;
      inpGenSec.value = String(secs);
      valGenSec.innerText = String(secs);
    });
    inpSpeed.addEventListener("input", () => {
      valSpeed.innerText = inpSpeed.value;
      SIM.speed = parseInt(inpSpeed.value);
    });
    togSensors.addEventListener("change", () => {
      SIM.showSensors = togSensors.checked;
    });
    togTrails.addEventListener("change", () => {
      SIM.showTrails = togTrails.checked;
    });
    togPhero.addEventListener("change", () => {
      SIM.showPhero = togPhero.checked;
    });
    togDebug.addEventListener("change", () => {
      SIM.debug = togDebug.checked;
      debugBox.style.display = SIM.debug ? "block" : "none";
    });
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        SIM.running = !SIM.running;
      }
      if (e.key === "n" || e.key === "N") {
        SIM.endGeneration();
        setUIFromSim();
      }
    });
  }

  function setUIFromSim() {
    valPop.innerText = String(SIM.lambda);
    valPopTotal.innerText = String(1 + SIM.lambda);
    popSizeLbl.innerText = String(1 + SIM.lambda);
    valSigma.innerText = SIM.sigma.toFixed(2);
    valGenSec.innerText = SIM.genSeconds;
    valSteps.innerText = SIM.stepsPerGen;
    valSpeed.innerText = SIM.speed;
    genLabel.innerText = SIM.generation;
    bestLabel.innerText = SIM.bestFitness;
    bestdelLabel.innerText = SIM.bestDelivered;
    champInfo.innerText = SIM.exportChampion();
  }

  function loop() {
    if (!SIM) {
      requestAnimationFrame(loop);
      return;
    }
    if (SIM.running) {
      for (let i = 0; i < SIM.speed; i++) SIM.stepAll();
    }
    draw(SIM.world, SIM.population, SIM);
    if (SIM.sanityFailed)
      drawRedText(ctx, "Sanity check failed - reset required");
    if (SIM.debug && SIM.population[0]) {
      const agent = SIM.population[0];
      debugBox.innerText = `champ age:${agent.age} fit:${agent.fitness.toFixed(
        1
      )} delivered:${agent.delivered}\npop:${SIM.population.length}`;
    }
    genLabel.innerText = SIM.generation;
    bestLabel.innerText = SIM.bestFitness;
    bestdelLabel.innerText = SIM.bestDelivered;
    popSizeLbl.innerText = SIM.population.length;
    requestAnimationFrame(loop);
  }

  setup();
  window.exportChampion = () => (SIM ? SIM.exportChampion() : null);
  window.importChampion = (j) => (SIM ? SIM.importChampion(j) : false);
  SIM.sanityCheck();
})();
