(() => {
  const SEED = null;
  const CONFIG = {
    DEFAULTS: {
      popSizeLambda: 49,
      sigma: 0.12,
      genSeconds: 20,
      stepsPerGen: 1200,
      speed: 2,
    },
    AGENT: {
      TRAIL_LENGTH: 60,
      SENSOR_COUNT: 5,
      BASE_RADIUS: 18,
      MINE_TIMER_BASE: 30, // Tempo mínimo para minerar (30 frames)
      DEPOSIT_TIMER_BASE: 15 // Tempo mínimo para depositar (15 frames)
    },
    PHYSICS: {
      MAX_SPEED: 2.2
    }
  };
  const DEFAULTS = CONFIG.DEFAULTS;

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

  const UI = DOMManager.init();
  const cvs = UI.canvas;
  const ctx = cvs.getContext("2d");

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
      this.base = { x: w / 2, y: h / 2, r: CONFIG.AGENT.BASE_RADIUS };
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
      this.deliveries = 0; // Para sistema lexicográfico
      this.hasMinedBefore = false; // Para sistema lexicográfico
      this.collisions = 0;
      this.age = 0;
      this.trail = [];
      this.fitness = 0;
      this.genome = genome;
      this.id = Math.floor(Math.random() * 1e9);
    }
    record() {
      if (window.SIM && window.SIM.turboMode) return; // Skip trails in turbo mode
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > CONFIG.AGENT.TRAIL_LENGTH) this.trail.shift();
    }
  }

  class Genome {
    constructor(rng) {
      this.sensorAngles = new Float32Array(CONFIG.AGENT.SENSOR_COUNT);
      for (let i = 0; i < CONFIG.AGENT.SENSOR_COUNT; i++)
        this.sensorAngles[i] = (i - 2) * 0.35 + rng.float(-0.15, 0.15);
      this.sensorRange = rng.float(80, 220);
      this.inputs = 22; // 15 sensores + 1 feromônio + 2 memória + 4 estado interno
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
      g.inputs = 22;
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
      this.storageKey = 'cooperacao_simulation';
      this.turboMode = false;
    }

    stepAgent(agent, genome, world, maxSpeed) {
      const inputs = this._calculateSensorInputs(agent, genome, world);
      const [acc, rot, mineOut] = genome.feed(inputs);
      const actionResult = this._processAgentActions(agent, world, mineOut);
      this._updateAgentPhysics(agent, acc, rot, maxSpeed);
      this._handleCollisions(agent, world);
      this._updatePheromones(agent, world);
      return { inputs, outputs: [acc, rot, mineOut], ...actionResult };
    }

    _calculateSensorInputs(agent, genome, world) {
      const range = genome.sensorRange;
      const inputs = new Array(22).fill(0);
      let idx = 0;
      agent.lastSeen = { angle: null, dist: null };
      
      for (let si = 0; si < CONFIG.AGENT.SENSOR_COUNT; si++) {
        const ang = agent.a + genome.sensorAngles[si];
        let tObstacle = this._findObstacleDistance(agent, ang, range, world);
        const prox = 1 - clamp((tObstacle === Infinity ? range : tObstacle) / range, 0, 1);
        
        const { stoneSig, baseSig } = this._calculateObjectSignals(agent, ang, range, tObstacle, world);
        
        inputs[idx++] = prox;
        inputs[idx++] = stoneSig;
        inputs[idx++] = baseSig;
      }
      
      inputs[idx++] = world.pher[world.pherCell(agent.x, agent.y)] || 0;
      const mem_angle_norm = agent.lastSeen.angle == null ? 0 : clamp(agent.lastSeen.angle / Math.PI, -1, 1);
      const mem_dist_norm = agent.lastSeen.dist == null ? 0 : clamp(1 - agent.lastSeen.dist, 0, 1);
      inputs[idx++] = mem_angle_norm;
      inputs[idx++] = mem_dist_norm;
      
      // Estado interno (4 entradas)
      inputs[idx++] = agent.carry ? 1.0 : 0.0; // Está carregando?
      inputs[idx++] = agent.state === "SEEK" ? 1.0 : 0.0; // Está procurando?
      inputs[idx++] = agent.state === "MINING" ? 1.0 : 0.0; // Está minerando?
      inputs[idx++] = agent.state === "DEPOSIT" ? 1.0 : 0.0; // Está depositando?
      
      return inputs;
    }

    _findObstacleDistance(agent, ang, range, world) {
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
      return tObstacle;
    }

    _calculateObjectSignals(agent, ang, range, tObstacle, world) {
      let stoneSig = 0, baseSig = 0;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      
      // Stone detection
      let bestTs = Infinity, bestStone = null;
      for (const s of world.stones) {
        if (s.quantity > 0) {
          const ts = rayCircleIntersectT(agent.x, agent.y, dx, dy, s.x, s.y, s.r);
          if (ts != null && ts >= 0 && ts <= range && ts < tObstacle && ts < bestTs) {
            bestTs = ts;
            bestStone = s;
          }
        }
      }
      
      if (bestStone) {
        stoneSig = 1 - bestTs / range;
        agent.lastSeen.angle = Math.atan2(bestStone.y - agent.y, bestStone.x - agent.x) - agent.a;
        agent.lastSeen.dist = clamp(dist(agent.x, agent.y, bestStone.x, bestStone.y) / Math.hypot(world.w, world.h), 0, 1);
      }
      
      // Base detection
      const tb = rayCircleIntersectT(agent.x, agent.y, dx, dy, world.base.x, world.base.y, world.base.r);
      if (tb != null && tb >= 0 && tb <= range && tb < tObstacle) {
        baseSig = 1 - tb / range;
        agent.lastSeen.angle = Math.atan2(world.base.y - agent.y, world.base.x - agent.x) - agent.a;
        agent.lastSeen.dist = clamp(dist(agent.x, agent.y, world.base.x, world.base.y) / Math.hypot(world.w, world.h), 0, 1);
      }
      
      return { stoneSig, baseSig };
    }

    _processAgentActions(agent, world, mineOut) {
      let justPicked = false, justDeposited = false, attemptedMine = false, attemptedDeposit = false;
      
      // PRIMEIRO: Verifica depósito automático (independente da decisão da rede neural)
      if (agent.carry && dist(agent.x, agent.y, world.base.x, world.base.y) < world.base.r + 14) {
        attemptedDeposit = true;
        agent.delivered++;
        agent.deliveries++;
        agent.carry = false;
        agent.state = "SEEK";
        justDeposited = true;
        return { justPicked, justDeposited, attemptedMine, attemptedDeposit };
      }
      
      // DEPOIS: Processa decisão de mineração da rede neural
      const wantsToMine = mineOut > 0.6;
      
      if (wantsToMine) {
        attemptedMine = true;
        
        const nearStone = this._findNearStone(agent, world);
        if (nearStone && !agent.carry) {
          agent.state = "MINING";
          agent.mineTimer = (agent.mineTimer || 0) + 1;
          
          if (agent.mineTimer >= CONFIG.AGENT.MINE_TIMER_BASE) {
            nearStone.quantity = Math.max(0, nearStone.quantity - 1);
            agent.carry = true;
            agent.hasMinedBefore = true;
            agent.state = "SEEK";
            agent.mineTimer = 0;
            justPicked = true;
          }
        } else {
          agent.state = "MINING"; // Fica parado se tenta minerar no lugar errado
        }
      } else {
        if (agent.state === "MINING" || agent.state === "DEPOSIT") {
          agent.state = "SEEK";
          agent.mineTimer = 0;
          agent.depositTimer = 0;
        }
      }
      
      return { justPicked, justDeposited, attemptedMine, attemptedDeposit };
    }

    _findNearStone(agent, world) {
      for (const s of world.stones) {
        if (s.quantity > 0 && dist(agent.x, agent.y, s.x, s.y) < s.r + 12) {
          return s;
        }
      }
      return null;
    }

    _updateAgentPhysics(agent, acc, rot, maxSpeed) {
      // Agente só pode se mover se NÃO estiver minerando ou depositando
      if (agent.state === "MINING" || agent.state === "DEPOSIT") {
        // Completamente imóvel durante mineração/depósito
        agent.v = 0;
        return;
      }
      
      // Movimento normal apenas quando em estado SEEK
      agent.v = agent.v * 0.6 + acc * maxSpeed * 0.9;
      agent.a += rot * 0.12;
      agent.x += Math.cos(agent.a) * agent.v * this.phy_dt;
      agent.y += Math.sin(agent.a) * agent.v * this.phy_dt;
    }

    _handleCollisions(agent, world) {
      // Boundary collisions
      if (agent.x < 2) {
        agent.x = 2;
        agent.v *= -0.2;
        agent.collisions++;
        agent.fitness += RewardSystem.calculateCollisionPenalty('boundary');
      }
      if (agent.y < 2) {
        agent.y = 2;
        agent.v *= -0.2;
        agent.collisions++;
        agent.fitness += RewardSystem.calculateCollisionPenalty('boundary');
      }
      if (agent.x > world.w - 2) {
        agent.x = world.w - 2;
        agent.v *= -0.2;
        agent.collisions++;
        agent.fitness += RewardSystem.calculateCollisionPenalty('boundary');
      }
      if (agent.y > world.h - 2) {
        agent.y = world.h - 2;
        agent.v *= -0.2;
        agent.collisions++;
        agent.fitness += RewardSystem.calculateCollisionPenalty('boundary');
      }
      
      // Obstacle collisions
      for (const ob of world.obstacles) {
        if (pointInRect(agent.x, agent.y, ob)) {
          const cx = ob.x + ob.w / 2, cy = ob.y + ob.h / 2;
          const dx = agent.x - cx, dy = agent.y - cy;
          const ax = Math.abs(dx), ay = Math.abs(dy);
          if (ax > ay) agent.x += (dx > 0 ? 1 : -1) * 4;
          else agent.y += (dy > 0 ? 1 : -1) * 4;
          agent.collisions++;
          agent.fitness += RewardSystem.calculateCollisionPenalty('obstacle');
        }
      }
    }

    _updatePheromones(agent, world) {
      if (!this.turboMode && agent.carry) {
        world.addPher(agent.x, agent.y, 0.02);
      }
      agent.a += (rng.rand() - 0.5) * 0.002;
    }

    initWorld() {
      const w = this.canvas.width, h = this.canvas.height;
      this.world = new World(w, h, 64, 48);
      
      // Usa MapGenerator para criar o mundo
      this.world.base = MapGenerator.generateBase(w, h, rng);
      this.world.obstacles = MapGenerator.generateObstacles(w, h, this.world.base, rng);
      this.world.stones = MapGenerator.generateStones(w, h, this.world.base, this.world.obstacles, 
        Math.max(this.lambda, this.minPopulation) * 3, rng); // 3x mais pedras
      
      this.world.pher.fill(0);
      this.buildPopulation();
      this.genStepCount = 0;
      if (this.genSeconds) this.stepsPerGen = Math.max(50, Math.round(this.genSeconds * 60));
    }



    regenStones(minTotalQuantity) {
      const w = this.canvas.width, h = this.canvas.height;
      this.world.stones = MapGenerator.generateStones(w, h, this.world.base, this.world.obstacles, minTotalQuantity, rng);
    }



    buildPopulation() {
      const lambda = clamp(this.lambda, this.minPopulation - 1, this.maxPopulation - 1);
      const popSize = 1 + lambda;
      
      if (this.population.length === 0) {
        // Tenta carregar população salva
        const loaded = this.loadFromStorage();
        if (loaded) {
          console.log(`População carregada: Gen ${this.generation}, ${this.population.length} agentes`);
          // Ajusta tamanho da população carregada se necessário
          this.adjustPopulationSize(popSize);
          return;
        }
        
        // Primeira geração: população aleatória
        this.population = [];
        for (let i = 0; i < popSize; i++) {
          const g = new Genome(rng);
          const a = new Agent(
            this.world.base.x + this.world.base.r + 6 + rng.float(-6, 6),
            this.world.base.y + rng.float(-6, 6),
            rng.float(0, Math.PI * 2),
            g
          );
          this.population.push(a);
        }
        this.champion = this.population[0].genome.clone();
      }
    }

    adjustPopulationSize(targetSize) {
      if (this.population.length === targetSize) return;
      
      if (this.population.length > targetSize) {
        // Remove agentes excedentes (mantém os melhores)
        this.population = this.population.slice(0, targetSize);
      } else {
        // Adiciona novos agentes baseados nos existentes
        while (this.population.length < targetSize) {
          const parent = this.population[rng.int(Math.min(5, this.population.length))];
          const mutatedGenome = parent.genome.mutate(rng, this.sigma);
          const newAgent = new Agent(
            this.world.base.x + this.world.base.r + 6 + rng.float(-6, 6),
            this.world.base.y + rng.float(-6, 6),
            rng.float(0, Math.PI * 2),
            mutatedGenome
          );
          this.population.push(newAgent);
        }
      }
    }

    sanityCheck() {
      let fail = null;
      if (!this.population || this.population.length < 1) fail = "population missing";
      if (!this.world || !this.world.stones || this.world.stones.length < 1) fail = "no stones";
      if (!(this.world.base.x > 0 && this.world.base.x < this.canvas.width && this.world.base.y > 0 && this.world.base.y < this.canvas.height)) fail = "base out of bounds";
      
      this.sanityFailed = !!fail;
      if (this.sanityFailed) drawRedText(this.ctx, fail);
      return !this.sanityFailed;
    }

    stepAll() {
      if (!this.sanityCheck()) return;
      const maxSpeed = CONFIG.PHYSICS.MAX_SPEED;
      this.genStepCount++;
      
      for (const agent of this.population) {
        const info = this.stepAgent(agent, agent.genome, this.world, maxSpeed);
        this._updateAgentFitness(agent, info);
        agent.age++;
        if (!this.turboMode) agent.record();
      }
      
      if (!this.turboMode) {
        this.world.decayPher(0.985);
      }
      if (this.genStepCount >= this.stepsPerGen) this.endGeneration();
    }

    _updateAgentFitness(agent, info) {
      // Usa o sistema de recompensas externo
      const reward = RewardSystem.calculateTotalFitness(agent, info, this.world);
      agent.fitness += reward;
    }

    endGeneration() {
      // Usa o novo sistema genético
      const evolutionResult = GeneticSystem.evolvePopulation(this.population, this.world, rng, Agent, Genome);
      
      this.population = evolutionResult.population;
      this.champion = evolutionResult.champion;
      this.bestFitness = Math.round(evolutionResult.bestFitness * 100) / 100;
      this.bestDelivered = evolutionResult.bestDelivered;
      this.generation++;
      
      this.regenStones(this.population.length + 2);
      this.genStepCount = 0;
      
      // Salva estado atual
      this.saveToStorage();
      
      // Atualiza visualizador de campeões (apenas se não estiver em turbo)
      if (!this.turboMode) {
        ChampionViewer.addChampion(
          this.exportChampion(),
          this.generation,
          this.bestFitness,
          this.bestDelivered
        );
      }
      
      // Atualiza gráfico de fitness
      ChartManager.addFitnessPoint(this.generation, this.bestFitness, this.bestDelivered);
      
      // Debug do sistema genético
      if (this.debug) {
        const stats = GeneticSystem.getStats();
        console.log(`Gen ${this.generation}: Sigma=${stats.adaptiveSigma}, Diversity=${stats.diversity}, Stagnant=${stats.isStagnant}`);
      }
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

    saveToStorage() {
      try {
        const saveData = {
          generation: this.generation,
          bestFitness: this.bestFitness,
          bestDelivered: this.bestDelivered,
          champion: this.champion.serialize(),
          population: this.population.map(agent => ({
            genome: agent.genome.serialize(),
            fitness: agent.fitness,
            delivered: agent.delivered
          })),
          geneticState: GeneticSystem.state,
          timestamp: Date.now()
        };
        localStorage.setItem(this.storageKey, JSON.stringify(saveData));
      } catch (e) {
        console.warn('Erro ao salvar simulação:', e);
      }
    }

    loadFromStorage() {
      try {
        const saved = localStorage.getItem(this.storageKey);
        if (!saved) return false;
        
        const data = JSON.parse(saved);
        
        this.generation = data.generation || 0;
        this.bestFitness = data.bestFitness || 0;
        this.bestDelivered = data.bestDelivered || 0;
        
        if (data.champion) {
          this.champion = Genome.deserialize(data.champion);
        }
        
        if (data.population && data.population.length > 0) {
          this.population = data.population.map(agentData => {
            const genome = Genome.deserialize(agentData.genome);
            const agent = new Agent(
              this.world.base.x + this.world.base.r + 6 + rng.float(-6, 6),
              this.world.base.y + rng.float(-6, 6),
              rng.float(0, Math.PI * 2),
              genome
            );
            agent.fitness = agentData.fitness || 0;
            agent.delivered = agentData.delivered || 0;
            return agent;
          });
        }
        
        if (data.geneticState) {
          GeneticSystem.state = { ...GeneticSystem.state, ...data.geneticState };
        }
        
        return true;
      } catch (e) {
        console.warn('Erro ao carregar simulação:', e);
        return false;
      }
    }

    clearStorage() {
      localStorage.removeItem(this.storageKey);
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
    Renderer.draw(world, pop, sim);
  }

  function drawPheromones(ctx, world, sim) {
    if (!sim.showPhero) return;
    
    const cols = world.pherCols, rows = world.pherRows;
    const cw = sim.canvas.width / cols, ch = sim.canvas.height / rows;
    
    ctx.globalCompositeOperation = "lighter";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = world.pher[y * cols + x];
        if (v > 0.001) {
          ctx.fillStyle = `rgba(20,120,220,${v * 0.18})`;
          ctx.fillRect(x * cw, y * ch, cw, ch);
        }
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawEnvironment(ctx, world) {
    // Draw obstacles
    ctx.fillStyle = "#2b2f37";
    for (const ob of world.obstacles) {
      ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
    }
    
    // Draw stones
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
    
    // Draw base
    ctx.beginPath();
    ctx.fillStyle = "#fff1a8";
    ctx.strokeStyle = "#d9b24a";
    ctx.arc(world.base.x, world.base.y, world.base.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function drawAgents(ctx, pop, sim, world) {
    // Draw trails
    if (sim.showTrails) {
      ctx.lineWidth = 1;
      for (const a of pop) {
        if (a.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(a.trail[0].x, a.trail[0].y);
          for (let i = 1; i < a.trail.length; i++) {
            ctx.lineTo(a.trail[i].x, a.trail[i].y);
          }
          ctx.strokeStyle = "rgba(255,255,255,0.03)";
          ctx.stroke();
        }
      }
    }
    
    // Draw agents
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
    
    // Highlight champion
    if (pop[0]) {
      ctx.beginPath();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.arc(pop[0].x, pop[0].y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawUI(ctx, sim) {
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
    for (let si = 0; si < CONFIG.AGENT.SENSOR_COUNT; si++) {
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
    initializeSimulation();
    setupInputs();
    ChampionViewer.loadFromStorage();
    ChartManager.init();
    setUIFromSim();
    SIM.initWorld();
    SIM.sanityCheck();
    attachEvents();
    requestAnimationFrame(loop);
  }

  function initializeSimulation() {
    SIM = new Simulation(cvs, ctx);
    SIM.lambda = DEFAULTS.popSizeLambda;
    SIM.sigma = DEFAULTS.sigma;
    SIM.genSeconds = DEFAULTS.genSeconds;
    SIM.stepsPerGen = DEFAULTS.stepsPerGen;
    SIM.speed = DEFAULTS.speed;
  }

  function setupInputs() {
    DOMManager.setupInputs(SIM);
  }

  function resizeCanvas() {
    DOMManager.resizeCanvas();
  }

  function attachEvents() {
    attachWindowEvents();
    attachCanvasEvents();
    attachButtonEvents();
    attachInputEvents();
    attachToggleEvents();
    attachKeyboardEvents();
  }

  function attachWindowEvents() {
    window.addEventListener("resize", () => {
      resizeCanvas();
      SIM.initWorld();
    });
  }

  function attachCanvasEvents() {
    cvs.addEventListener("click", (e) => {
      const r = cvs.getBoundingClientRect();
      const x = (e.clientX - r.left) * (cvs.width / r.width);
      const y = (e.clientY - r.top) * (cvs.height / r.height);
      SIM.world.base.x = x;
      SIM.world.base.y = y;
      SIM.initWorld();
    });
  }

  function attachButtonEvents() {
    UI.buttons.reset.addEventListener("click", handleReset);
    UI.buttons.start.addEventListener("click", () => SIM.running = true);
    UI.buttons.stop.addEventListener("click", () => SIM.running = false);
    UI.buttons.next.addEventListener("click", handleNextGeneration);
  }

  function attachInputEvents() {
    UI.inputs.pop.addEventListener("input", handlePopulationChange);
    UI.inputs.sigma.addEventListener("input", handleSigmaChange);
    UI.inputs.genSec.addEventListener("input", handleGenSecondsChange);
    UI.inputs.steps.addEventListener("input", handleStepsChange);
    UI.inputs.speed.addEventListener("input", handleSpeedChange);
  }

  function attachToggleEvents() {
    UI.toggles.sensors.addEventListener("change", () => SIM.showSensors = UI.toggles.sensors.checked);
    UI.toggles.trails.addEventListener("change", () => SIM.showTrails = UI.toggles.trails.checked);
    UI.toggles.phero.addEventListener("change", () => SIM.showPhero = UI.toggles.phero.checked);
    UI.toggles.debug.addEventListener("change", handleDebugToggle);
    
    // Turbo mode toggle
    const turboToggle = document.getElementById('togTurbo');
    if (turboToggle) {
      turboToggle.addEventListener("change", handleTurboToggle);
    }
  }

  function attachKeyboardEvents() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") SIM.running = !SIM.running;
      if (e.key === "n" || e.key === "N") {
        SIM.endGeneration();
        setUIFromSim();
      }
    });
  }

  // Event handlers
  function handleReset() {
    rng = new RNG(SEED);
    SIM = new Simulation(cvs, ctx);
    SIM.lambda = parseInt(UI.inputs.pop.value);
    SIM.sigma = parseFloat(UI.inputs.sigma.value);
    SIM.genSeconds = parseInt(UI.inputs.genSec.value);
    SIM.stepsPerGen = Math.max(100, Math.round(SIM.genSeconds * 60));
    SIM.speed = parseInt(UI.inputs.speed.value);
    SIM.clearStorage();
    SIM.initWorld();
    ChampionViewer.clearHistory();
    ChartManager.clearHistory();
    setUIFromSim();
  }

  function handleNextGeneration() {
    if (!SIM.sanityCheck()) return;
    SIM.endGeneration();
    setUIFromSim();
  }

  function handleSaveChampion() {
    const js = SIM.exportChampion();
    UI.other.champJson.value = js;
    UI.other.champInfo.innerText = js.slice(0, 800);
  }

  function handleLoadChampion() {
    if (UI.other.champJson.value.trim().length > 10) {
      const ok = SIM.importChampion(UI.other.champJson.value.trim());
      if (ok) alert("Champion loaded");
      else alert("Falha ao carregar");
    }
  }

  function handlePopulationChange() {
    UI.values.pop.innerText = String(parseInt(UI.inputs.pop.value));
    SIM.lambda = parseInt(UI.inputs.pop.value);
    UI.values.popTotal.innerText = String(1 + SIM.lambda);
    UI.labels.popSize.innerText = String(1 + SIM.lambda);
    
    // Ajusta população atual se já existe
    if (SIM.population.length > 0) {
      SIM.adjustPopulationSize(1 + SIM.lambda);
    }
  }

  function handleSigmaChange() {
    UI.values.sigma.innerText = parseFloat(UI.inputs.sigma.value).toFixed(2);
    SIM.sigma = parseFloat(UI.inputs.sigma.value);
  }

  function handleGenSecondsChange() {
    UI.values.genSec.innerText = UI.inputs.genSec.value;
    SIM.genSeconds = parseInt(UI.inputs.genSec.value);
    SIM.stepsPerGen = Math.max(50, Math.round(SIM.genSeconds * 60));
    UI.inputs.steps.value = String(SIM.stepsPerGen);
    UI.values.steps.innerText = String(SIM.stepsPerGen);
  }

  function handleStepsChange() {
    UI.values.steps.innerText = UI.inputs.steps.value;
    SIM.stepsPerGen = parseInt(UI.inputs.steps.value);
    const secs = Math.max(1, Math.round(SIM.stepsPerGen / 60));
    SIM.genSeconds = secs;
    UI.inputs.genSec.value = String(secs);
    UI.values.genSec.innerText = String(secs);
  }

  function handleSpeedChange() {
    UI.values.speed.innerText = UI.inputs.speed.value;
    SIM.speed = parseInt(UI.inputs.speed.value);
  }

  function handleDebugToggle() {
    SIM.debug = UI.toggles.debug.checked;
    UI.other.debugBox.style.display = SIM.debug ? "block" : "none";
  }

  function handleTurboToggle() {
    const turboToggle = document.getElementById('togTurbo');
    SIM.turboMode = turboToggle.checked;
    
    if (SIM.turboMode) {
      // Desabilita visualizações pesadas
      SIM.showSensors = false;
      SIM.showTrails = false;
      SIM.showPhero = false;
      
      // Aumenta velocidade drasticamente
      SIM.speed = Math.max(SIM.speed, 50);
      
      // Limpa trails existentes para economizar memória
      SIM.population.forEach(agent => agent.trail = []);
      
      console.log('Modo Turbo ativado - Performance máxima');
    } else {
      // Restaura visualizações
      SIM.showSensors = UI.toggles.sensors.checked;
      SIM.showTrails = UI.toggles.trails.checked;
      SIM.showPhero = UI.toggles.phero.checked;
      
      console.log('Modo Turbo desativado');
    }
  }

  function setUIFromSim() {
    DOMManager.updateUI(SIM);
    
    // Atualiza visualizador se há dados
    if (SIM.generation > 0) {
      ChampionViewer.addChampion(
        SIM.exportChampion(),
        SIM.generation,
        SIM.bestFitness,
        SIM.bestDelivered
      );
      ChartManager.addFitnessPoint(SIM.generation, SIM.bestFitness, SIM.bestDelivered);
    }
  }

  function loop() {
    if (!SIM) {
      requestAnimationFrame(loop);
      return;
    }
    
    if (SIM.running) {
      const iterations = SIM.turboMode ? Math.min(SIM.speed * 10, 500) : SIM.speed;
      for (let i = 0; i < iterations; i++) {
        SIM.stepAll();
      }
    }
    
    // Renderização condicional
    if (!SIM.turboMode) {
      draw(SIM.world, SIM.population, SIM);
      if (SIM.sanityFailed)
        Renderer.drawRedText(ctx, "Sanity check failed - reset required");
    } else {
      // Modo turbo: apenas limpa canvas e mostra stats essenciais
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      ctx.fillStyle = '#58a6ff';
      ctx.font = '24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MODO TURBO', cvs.width/2, cvs.height/2 - 40);
      ctx.font = '16px monospace';
      ctx.fillText(`Gen: ${SIM.generation} | Fit: ${SIM.bestFitness} | Del: ${SIM.bestDelivered}`, cvs.width/2, cvs.height/2);
      ctx.fillText(`Pop: ${SIM.population.length} | Speed: ${SIM.speed}x`, cvs.width/2, cvs.height/2 + 30);
    }
    
    if (SIM.debug && SIM.population[0] && !SIM.turboMode) {
      const agent = SIM.population[0];
      UI.other.debugBox.innerText = `champ age:${agent.age} fit:${agent.fitness.toFixed(1)} delivered:${agent.delivered}\npop:${SIM.population.length}`;
    }
    
    // Atualiza labels sempre
    UI.labels.gen.innerText = SIM.generation;
    UI.labels.best.innerText = SIM.bestFitness;
    UI.labels.bestdel.innerText = SIM.bestDelivered;
    UI.labels.popSize.innerText = SIM.population.length;
    
    requestAnimationFrame(loop);
  }

  setup();
  window.exportChampion = () => (SIM ? SIM.exportChampion() : null);
  window.importChampion = (j) => (SIM ? SIM.importChampion(j) : false);
  SIM.sanityCheck();
})();