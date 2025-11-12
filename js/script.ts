(() => {
  const SEED: number | null = null;

  const CONFIG = {
    POPULATION: { LAMBDA: 99, MIN_SIZE: 50, MAX_SIZE: 300 },
    GENETIC: { SIGMA: 0.15 },
    SIMULATION: {
      GEN_SECONDS: 30,
      GEN_SECONDS_MIN: 10,
      GEN_SECONDS_MAX: 120,
      STEPS_PER_GEN: 1800,
      STEPS_PER_GEN_MIN: 600,
      STEPS_PER_GEN_MAX: 3600,
      SPEED: 5,

      MAX_POPULATION: 300,
      MIN_POPULATION: 50,
      STORAGE_KEY: "cooperacao_simulation",
    },
    AGENT: {
      TRAIL_LENGTH: 60,
      SENSOR_COUNT: 5,
      BASE_RADIUS: 18,
      MINE_TIMER_BASE: 30,
    },
    PHYSICS: {
      MAX_SPEED: 2.2,
      VELOCITY_DECAY: 0.6,
      ACCELERATION_FACTOR: 0.9,
      ROTATION_FACTOR: 0.12,
      COLLISION_VELOCITY_FACTOR: -0.2,
      COLLISION_PUSH_DISTANCE: 4,
      BOUNDARY_MARGIN: 2,
    },
    GENOME: {
      INPUTS: 20,
      HIDDEN: 8,
      OUTPUTS: 3,
      SENSOR_ANGLE_BASE: 0.35,
      SENSOR_ANGLE_VARIATION: 0.15,
      SENSOR_RANGE_MIN: 80,
      SENSOR_RANGE_MAX: 220,
      WEIGHT_INIT_STD: 0.8,
      BIAS_INIT_STD: 0.5,
      MUTATION_SIGMA_FACTOR: 0.6,
      MUTATION_RANGE_FACTOR: 20,
      MIN_SENSOR_RANGE: 30,
    },
    ACTIONS: {
      MINE_THRESHOLD: 0.6,
      DEPOSIT_DISTANCE: 14,
      STONE_PICKUP_DISTANCE: 12,
      RANDOM_ROTATION: 0.002,
    },
  };

  class RNG {
    private _useMath: boolean;
    private _state: number;
    private _next: number | null = null;

    constructor(seed: number | null = null) {
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
    int(max: number): number {
      return Math.floor(this.rand() * max);
    }
    float(min: number, max: number): number {
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
  }

  const UI = DOMManager.init();
  const cvs: HTMLCanvasElement = UI.canvas;
  const ctx: CanvasRenderingContext2D = cvs.getContext("2d")!;

  let rng: RNG = new RNG(SEED);
  let SIM: Simulation | null = null;

  const { clamp, pointInRect } = GeometryUtils;

  class World {
    w: number;
    h: number;
    base: Base;
    stones: Stone[];
    obstacles: Rect[];
    stonesDelivered: number;
    constructor(w: number, h: number) {
      this.w = w;
      this.h = h;
      this.base = { x: w / 2, y: h / 2, r: CONFIG.AGENT.BASE_RADIUS };
      this.stones = [];
      this.obstacles = [];
      this.stonesDelivered = 0;
    }
  }

  class Agent {
    x: number;
    y: number;
    a: number;
    v: number;
    state: "SEEK" | "MINING" | "CARRYING";
    mineTimer: number;

    memory: { angle: number; dist: number };
    delivered: number;
    deliveries: number;
    hasMinedBefore: boolean;
    collisions: number;
    age: number;
    trail: Point[];
    fitness: number;
    genome: Genome | null;
    id: number;
    lastSeen?: { angle: number | null; dist: number | null };
    sensorData?: SensorData[];
    hasLeftBase: boolean;
    formaDeNascimento?: "elite" | "mutacao" | "mesclagem" | "random";
    stepsCarrying: number;
    totalEfficiencyBonus: number;

    constructor(
      x: number,
      y: number,
      angle: number = 0,
      genome: Genome | null = null
    ) {
      this.x = x;
      this.y = y;
      this.a = angle;
      this.v = 0;
      this.state = "SEEK";
      this.mineTimer = 0;

      this.memory = { angle: 0, dist: 0 };
      this.delivered = 0;
      this.deliveries = 0;
      this.hasMinedBefore = false;
      this.collisions = 0;
      this.age = 0;
      this.trail = [];
      this.fitness = 0;
      this.genome = genome;
      this.id = Math.floor(Math.random() * 1e9);
      this.hasLeftBase = false;
      this.formaDeNascimento = "random";
      this.stepsCarrying = 0;
      this.totalEfficiencyBonus = 0;
    }
    record() {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > CONFIG.AGENT.TRAIL_LENGTH) this.trail.shift();
    }
  }

  class Genome {
    sensorAngles: Float32Array;
    sensorRange: number;
    inputs: number;
    hidden: number;
    outputs: number;
    hiddenWeights: Float32Array;
    hiddenBiases: Float32Array;
    outputWeights: Float32Array;
    outputBiases: Float32Array;

    constructor(rng: RNG) {
      this.sensorAngles = new Float32Array(CONFIG.AGENT.SENSOR_COUNT);
      for (let i = 0; i < CONFIG.AGENT.SENSOR_COUNT; i++)
        this.sensorAngles[i] =
          (i - 2) * CONFIG.GENOME.SENSOR_ANGLE_BASE +
          rng.float(
            -CONFIG.GENOME.SENSOR_ANGLE_VARIATION,
            CONFIG.GENOME.SENSOR_ANGLE_VARIATION
          );
      this.sensorRange = rng.float(
        CONFIG.GENOME.SENSOR_RANGE_MIN,
        CONFIG.GENOME.SENSOR_RANGE_MAX
      );
      this.inputs = CONFIG.GENOME.INPUTS;
      this.hidden = CONFIG.GENOME.HIDDEN;
      this.outputs = CONFIG.GENOME.OUTPUTS;

      this.hiddenWeights = new Float32Array(this.inputs * this.hidden);
      this.hiddenBiases = new Float32Array(this.hidden);
      this.outputWeights = new Float32Array(this.hidden * this.outputs);
      this.outputBiases = new Float32Array(this.outputs);

      for (let i = 0; i < this.hiddenWeights.length; i++)
        this.hiddenWeights[i] = rng.gaussian(0, CONFIG.GENOME.WEIGHT_INIT_STD);
      for (let i = 0; i < this.hiddenBiases.length; i++)
        this.hiddenBiases[i] = rng.gaussian(0, CONFIG.GENOME.BIAS_INIT_STD);
      for (let i = 0; i < this.outputWeights.length; i++)
        this.outputWeights[i] = rng.gaussian(0, CONFIG.GENOME.WEIGHT_INIT_STD);
      for (let i = 0; i < this.outputBiases.length; i++)
        this.outputBiases[i] = rng.gaussian(0, CONFIG.GENOME.BIAS_INIT_STD);
    }

    clone() {
      const g = Object.create(Genome.prototype);
      g.sensorAngles = new Float32Array(this.sensorAngles);
      g.sensorRange = this.sensorRange;
      g.inputs = this.inputs;
      g.hidden = this.hidden;
      g.outputs = this.outputs;
      g.hiddenWeights = new Float32Array(this.hiddenWeights);
      g.hiddenBiases = new Float32Array(this.hiddenBiases);
      g.outputWeights = new Float32Array(this.outputWeights);
      g.outputBiases = new Float32Array(this.outputBiases);
      return g;
    }

    mutate(rng: RNG, sigma: number): Genome {
      const g = this.clone();
      for (let i = 0; i < g.sensorAngles.length; i++)
        g.sensorAngles[i] +=
          rng.gaussian(0, 1) * sigma * CONFIG.GENOME.MUTATION_SIGMA_FACTOR;
      g.sensorRange +=
        rng.gaussian(0, 1) * sigma * CONFIG.GENOME.MUTATION_RANGE_FACTOR;
      g.sensorRange = Math.max(CONFIG.GENOME.MIN_SENSOR_RANGE, g.sensorRange);
      for (let i = 0; i < g.hiddenWeights.length; i++)
        g.hiddenWeights[i] += rng.gaussian(0, 1) * sigma;
      for (let i = 0; i < g.hiddenBiases.length; i++)
        g.hiddenBiases[i] += rng.gaussian(0, 1) * sigma;
      for (let i = 0; i < g.outputWeights.length; i++)
        g.outputWeights[i] += rng.gaussian(0, 1) * sigma;
      for (let i = 0; i < g.outputBiases.length; i++)
        g.outputBiases[i] += rng.gaussian(0, 1) * sigma;
      return g;
    }

    feed(inputs: number[]): number[] {
      const hidden = new Array(this.hidden);
      for (let h = 0; h < this.hidden; h++) {
        let sum = this.hiddenBiases[h];
        for (let i = 0; i < this.inputs; i++)
          sum += inputs[i] * this.hiddenWeights[i * this.hidden + h];
        hidden[h] = Math.tanh(sum);
      }
      const outputs = new Array(this.outputs);
      for (let o = 0; o < this.outputs; o++) {
        let sum = this.outputBiases[o];
        for (let h = 0; h < this.hidden; h++)
          sum += hidden[h] * this.outputWeights[h * this.outputs + o];
        outputs[o] = o === 1 ? Math.tanh(sum) : 1 / (1 + Math.exp(-sum));
      }
      return outputs;
    }

    serialize() {
      return JSON.stringify({
        sensorAngles: Array.from(this.sensorAngles),
        sensorRange: this.sensorRange,
        hiddenWeights: Array.from(this.hiddenWeights),
        hiddenBiases: Array.from(this.hiddenBiases),
        outputWeights: Array.from(this.outputWeights),
        outputBiases: Array.from(this.outputBiases),
      });
    }

    static deserialize(json: string): Genome {
      const o = JSON.parse(json);
      const g = Object.create(Genome.prototype);
      g.sensorAngles = new Float32Array(o.sensorAngles);
      g.sensorRange = o.sensorRange;
      g.inputs = CONFIG.GENOME.INPUTS;
      g.hidden = CONFIG.GENOME.HIDDEN;
      g.outputs = CONFIG.GENOME.OUTPUTS;
      g.hiddenWeights = new Float32Array(o.hiddenWeights || []);
      g.hiddenBiases = new Float32Array(o.hiddenBiases || []);
      g.outputWeights = new Float32Array(o.outputWeights || []);
      g.outputBiases = new Float32Array(o.outputBiases || []);
      return g;
    }
  }

  class Simulation {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    phy_dt: number;
    genSeconds: number;
    stepsPerGen: number;
    speed: number;
    lambda: number;
    sigma: number;
    world: World;
    generation: number;
    running: boolean;
    showSensors: boolean;
    showTrails: boolean;
    debug: boolean;
    debugMode: boolean;
    lastStepResult: StepResult | null;
    trackedAgent: Agent | null;
    population: Agent[];
    maxPopulation: number;
    minPopulation: number;
    genStepCount: number;
    bestFitness: number;
    bestDelivered: number;
    sanityFailed: boolean;
    storageKey: string;

    constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
      this.canvas = canvas;
      this.ctx = ctx;
      this.phy_dt = 1;
      this.genSeconds = CONFIG.SIMULATION.GEN_SECONDS;
      this.stepsPerGen = CONFIG.SIMULATION.STEPS_PER_GEN;
      this.speed = CONFIG.SIMULATION.SPEED;
      this.lambda = CONFIG.POPULATION.LAMBDA;
      this.sigma = CONFIG.GENETIC.SIGMA;
      this.world = new World(canvas.width, canvas.height);
      this.generation = 0;
      this.running = false;
      this.showSensors = false;
      this.showTrails = false;
      this.debug = false;
      this.debugMode = false;
      this.lastStepResult = null;
      this.trackedAgent = null;
      this.population = [];
      this.maxPopulation = CONFIG.SIMULATION.MAX_POPULATION;
      this.minPopulation = CONFIG.SIMULATION.MIN_POPULATION;
      this.genStepCount = 0;
      this.bestFitness = 0;
      this.bestDelivered = 0;
      this.sanityFailed = false;
      this.storageKey = CONFIG.SIMULATION.STORAGE_KEY;
    }

    stepAgent(
      agent: Agent,
      genome: Genome,
      world: World,
      maxSpeed: number
    ): StepResult {
      const inputs = this._calculateSensorInputs(agent, genome, world);
      const [acc, rot, mineOut] = genome.feed(inputs);
      const actionResult = this._processAgentActions(agent, world, mineOut);
      this._updateAgentPhysics(agent, acc, rot, maxSpeed);
      this._handleCollisions(agent, world);
      agent.a += (rng.rand() - 0.5) * CONFIG.ACTIONS.RANDOM_ROTATION;
      agent.a = GeometryUtils.normalizeAngle(agent.a);
      return { inputs, outputs: [acc, rot, mineOut], ...actionResult };
    }

    _calculateSensorInputs(
      agent: Agent,
      genome: Genome,
      world: World
    ): number[] {
      agent.lastSeen = { angle: null, dist: null };
      const sensorData = SensorSystem.calculateSensorData(agent, genome, world);
      agent.sensorData = sensorData;
      return SensorSystem.extractInputs(sensorData, agent, world);
    }

    _processAgentActions(
      agent: Agent,
      world: World,
      mineOut: number
    ): ActionResult {
      let justPicked = false,
        justDeposited = false,
        attemptedMine = false,
        attemptedDeposit = false;

      if (agent.state === "CARRYING") {
        const dx = agent.x - world.base.x,
          dy = agent.y - world.base.y;
        const maxDist = world.base.r + CONFIG.ACTIONS.DEPOSIT_DISTANCE;
        if (dx * dx + dy * dy < maxDist * maxDist) {
          attemptedDeposit = true;
          agent.delivered++;
          agent.deliveries++;

          // Bônus de eficiência: entregas rápidas valem mais
          const cycleTime = agent.stepsCarrying;
          const efficiencyBonus = Math.max(0, 1000 - cycleTime);
          agent.totalEfficiencyBonus += efficiencyBonus;

          agent.state = "SEEK";
          agent.stepsCarrying = 0; // Reseta contador
          justDeposited = true;
          world.stonesDelivered++;
          return { justPicked, justDeposited, attemptedMine, attemptedDeposit };
        }
      }

      const wantsToMine = mineOut > CONFIG.ACTIONS.MINE_THRESHOLD;
      if (wantsToMine) {
        attemptedMine = true;
        const nearStone = this._findNearStone(agent, world);

        // Agente pode entrar em MINING quando quiser (comportamento do agente)
        if (nearStone && agent.state !== "CARRYING") {
          agent.state = "MINING";
          agent.mineTimer = (agent.mineTimer || 0) + 1;

          // Ambiente só permite pegar pedra se NÃO estiver carregando
          if (agent.mineTimer >= CONFIG.AGENT.MINE_TIMER_BASE) {
            nearStone.quantity = Math.max(0, nearStone.quantity - 1);
            agent.state = "CARRYING";
            agent.hasMinedBefore = true;
            agent.mineTimer = 0;
            agent.stepsCarrying = 0;
            justPicked = true;
          }
        } else {
          // Quer minerar mas não tem pedra perto OU já está carregando
          // Agente pode entrar em MINING de qualquer forma
          agent.state = "MINING";
        }
      } else {
        if (agent.state === "MINING") {
          agent.state = "SEEK";
          agent.mineTimer = 0;
        }
      }
      return { justPicked, justDeposited, attemptedMine, attemptedDeposit };
    }

    _findNearStone(agent: Agent, world: World): Stone | null {
      const maxDist = CONFIG.ACTIONS.STONE_PICKUP_DISTANCE;
      for (const s of world.stones) {
        if (s.quantity > 0) {
          const dx = agent.x - s.x,
            dy = agent.y - s.y,
            threshold = s.r + maxDist;
          if (dx * dx + dy * dy < threshold * threshold) return s;
        }
      }
      return null;
    }

    _updateAgentPhysics(
      agent: Agent,
      acc: number,
      rot: number,
      maxSpeed: number
    ): void {
      if (agent.state === "MINING") {
        agent.v = 0;
        return;
      }
      agent.v =
        agent.v * CONFIG.PHYSICS.VELOCITY_DECAY +
        acc * maxSpeed * CONFIG.PHYSICS.ACCELERATION_FACTOR;
      agent.a += rot * CONFIG.PHYSICS.ROTATION_FACTOR;
      agent.a = GeometryUtils.normalizeAngle(agent.a);
      agent.x += Math.cos(agent.a) * agent.v * this.phy_dt;
      agent.y += Math.sin(agent.a) * agent.v * this.phy_dt;
    }

    _handleCollisions(agent: Agent, world: World): void {
      if (agent.x < CONFIG.PHYSICS.BOUNDARY_MARGIN) {
        agent.x = CONFIG.PHYSICS.BOUNDARY_MARGIN;
        agent.v *= CONFIG.PHYSICS.COLLISION_VELOCITY_FACTOR;
        agent.collisions++;
        agent.fitness += RewardSystem.calculateCollisionPenalty("boundary");
      }
      if (agent.y < CONFIG.PHYSICS.BOUNDARY_MARGIN) {
        agent.y = CONFIG.PHYSICS.BOUNDARY_MARGIN;
        agent.v *= CONFIG.PHYSICS.COLLISION_VELOCITY_FACTOR;
        agent.collisions++;
        agent.fitness += RewardSystem.calculateCollisionPenalty("boundary");
      }
      if (agent.x > world.w - CONFIG.PHYSICS.BOUNDARY_MARGIN) {
        agent.x = world.w - CONFIG.PHYSICS.BOUNDARY_MARGIN;
        agent.v *= CONFIG.PHYSICS.COLLISION_VELOCITY_FACTOR;
        agent.collisions++;
        agent.fitness += RewardSystem.calculateCollisionPenalty("boundary");
      }
      if (agent.y > world.h - CONFIG.PHYSICS.BOUNDARY_MARGIN) {
        agent.y = world.h - CONFIG.PHYSICS.BOUNDARY_MARGIN;
        agent.v *= CONFIG.PHYSICS.COLLISION_VELOCITY_FACTOR;
        agent.collisions++;
        agent.fitness += RewardSystem.calculateCollisionPenalty("boundary");
      }

      for (const ob of world.obstacles) {
        if (pointInRect(agent.x, agent.y, ob)) {
          const centerX = ob.x + ob.w * 0.5,
            centerY = ob.y + ob.h * 0.5;
          agent.x +=
            (agent.x > centerX ? 1 : -1) *
            CONFIG.PHYSICS.COLLISION_PUSH_DISTANCE;
          agent.y +=
            (agent.y > centerY ? 1 : -1) *
            CONFIG.PHYSICS.COLLISION_PUSH_DISTANCE;
          agent.collisions++;
          agent.fitness += RewardSystem.calculateCollisionPenalty("obstacle");
        }
      }
    }

    initWorld() {
      const w = this.canvas.width,
        h = this.canvas.height;
      this.world = new World(w, h);
      this.world.base = MapGenerator.generateBase(w, h, rng);
      this.world.obstacles = MapGenerator.generateObstacles(
        w,
        h,
        this.world.base,
        rng
      );
      this.world.stones = MapGenerator.generateStones(
        w,
        h,
        this.world.base,
        this.world.obstacles,
        Math.max(this.lambda, this.minPopulation) * 3,
        rng
      );
      this.buildPopulation();
      this.genStepCount = 0;
      if (this.genSeconds)
        this.stepsPerGen = Math.max(50, Math.round(this.genSeconds * 60));
    }

    regenStones(minTotalQuantity: number): void {
      const w = this.canvas.width,
        h = this.canvas.height;
      this.world.stones = MapGenerator.generateStones(
        w,
        h,
        this.world.base,
        this.world.obstacles,
        minTotalQuantity,
        rng
      );
    }

    buildPopulation() {
      const popSize = this.debugMode
        ? 1
        : 1 +
          clamp(this.lambda, this.minPopulation - 1, this.maxPopulation - 1);

      localStorage.removeItem(this.storageKey);
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
    }

    stepAll() {
      if (!this.sanityCheck()) return;
      const maxSpeed = CONFIG.PHYSICS.MAX_SPEED;
      this.genStepCount++;
      for (const agent of this.population) {
        const info = this.stepAgent(agent, agent.genome, this.world, maxSpeed);

        // Incrementa contador se estiver carregando
        if (agent.state === "CARRYING") {
          agent.stepsCarrying++;
        }

        this._updateAgentFitness(agent, info);
        agent.age++;
        agent.record();

        if (
          agent === this.population[0] ||
          agent.formaDeNascimento === "elite"
        ) {
          this.lastStepResult = info;
        }
      }

      // Verifica e respawna pedras que foram totalmente mineradas
      this._checkAndRespawnStones();

      if (this.genStepCount >= this.stepsPerGen) {
        this.endGeneration();
      }
    }

    _updateAgentFitness(agent: Agent, info: ActionResult): void {
      this._trackBaseExit(agent, this.world);
      const reward = RewardSystem.calculateTotalFitness(
        agent,
        info,
        this.world
      );
      agent.fitness += reward;
    }

    _trackBaseExit(agent: Agent, world: World): void {
      const distToBase = Math.hypot(
        agent.x - world.base.x,
        agent.y - world.base.y
      );
      const baseRadius = world.base.r + 25;
      if (distToBase > baseRadius) agent.hasLeftBase = true;
      if (agent.delivered > 0 && distToBase <= baseRadius)
        agent.hasLeftBase = false;
    }

    _checkAndRespawnStones(): void {
      // Verifica cada pedra e respawna se necessário
      for (let i = 0; i < this.world.stones.length; i++) {
        const stone = this.world.stones[i];
        if (stone.quantity <= 0) {
          // Pedra esgotada - cria uma nova
          const newStone = MapGenerator.respawnStone(
            this.world.w,
            this.world.h,
            this.world.base,
            this.world.obstacles,
            this.world.stones,
            stone.initialQuantity, // Mantém a quantidade inicial original
            rng
          );

          if (newStone) {
            // Substitui a pedra esgotada pela nova
            this.world.stones[i] = newStone;
          }
        }
      }
    }

    endGeneration() {
      if (this.debugMode) {
        // No modo debug, apenas reseta o agente e regenera pedras
        const agent = this.population[0];
        if (agent) {
          agent.x =
            this.world.base.x + this.world.base.r + 6 + rng.float(-6, 6);
          agent.y = this.world.base.y + rng.float(-6, 6);
          agent.a = rng.float(0, Math.PI * 2);
          agent.v = 0;
          agent.state = "SEEK";
          agent.mineTimer = 0;
          agent.age = 0;
          agent.trail = [];
          agent.fitness = 0;
          agent.delivered = 0;
          agent.deliveries = 0;
          agent.hasMinedBefore = false;
          agent.collisions = 0;
          agent.hasLeftBase = false;
          agent.stepsCarrying = 0;
          agent.totalEfficiencyBonus = 0;
        }
        this.generation++;
        this.regenStones(3);
        this.genStepCount = 0;
        DOMManager.clearHistory();
        return;
      }

      const evolutionResult = GeneticSystem.evolvePopulation(
        this.population,
        this.world,
        rng,
        Agent,
        Genome
      );

      const totalDelivered = this.population.reduce(
        (sum, agent) => sum + agent.delivered,
        0
      );

      this.population = evolutionResult.population;
      this.bestFitness = Math.round(evolutionResult.bestFitness * 100) / 100;
      this.bestDelivered = evolutionResult.bestDelivered;
      this.generation++;
      this.regenStones(this.population.length + 2);
      this.genStepCount = 0;

      // Limpa histórico do debug ao iniciar nova geração
      DOMManager.clearHistory();

      ChartManager.addFitnessPoint(
        this.generation,
        this.bestFitness,
        this.bestDelivered,
        totalDelivered
      );
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
      if (this.sanityFailed) Renderer.drawRedText(this.ctx, fail);
      return !this.sanityFailed;
    }
  }

  function setup() {
    DOMManager.resizeCanvas();
    SIM = new Simulation(cvs, ctx);
    SIM.lambda = CONFIG.POPULATION.LAMBDA;
    SIM.sigma = CONFIG.GENETIC.SIGMA;
    SIM.genSeconds = CONFIG.SIMULATION.GEN_SECONDS;
    SIM.stepsPerGen = CONFIG.SIMULATION.STEPS_PER_GEN;
    SIM.speed = CONFIG.SIMULATION.SPEED;
    (window as unknown as WindowType).SIM = SIM;
    ChartManager.init();
    DOMManager.setupInputs();
    DOMManager.updateUI(SIM);
    SIM.initWorld();
    SIM.sanityCheck();

    window.addEventListener("resize", () => {
      DOMManager.resizeCanvas();
      SIM.initWorld();
    });

    UI.buttons.reset.addEventListener("click", () => {
      rng = new RNG(SEED);
      SIM = new Simulation(cvs, ctx);
      SIM.lambda = CONFIG.POPULATION.LAMBDA;
      SIM.sigma = CONFIG.GENETIC.SIGMA;
      SIM.genSeconds = CONFIG.SIMULATION.GEN_SECONDS;
      SIM.stepsPerGen = CONFIG.SIMULATION.STEPS_PER_GEN;
      SIM.speed = CONFIG.SIMULATION.SPEED;
      SIM.debugMode = false;
      SIM.initWorld();
      DOMManager.updateUI(SIM);

      const debugPanel = document.getElementById("debugPanel");
      const debugBtn = document.getElementById("btnDebug");
      if (debugPanel) debugPanel.style.display = "none";
      if (debugBtn) debugBtn.classList.remove("active");
    });

    UI.buttons.debug.addEventListener("click", () => {
      SIM.debugMode = !SIM.debugMode;
      const debugPanel = document.getElementById("debugPanel");
      const debugBtn = document.getElementById("btnDebug");

      if (SIM.debugMode) {
        debugBtn.classList.add("active");
        debugPanel.style.display = "block";
      } else {
        debugBtn.classList.remove("active");
        debugPanel.style.display = "none";
      }

      SIM.buildPopulation();
      DOMManager.updateUI(SIM);
    });

    UI.buttons.downloadDebug.addEventListener("click", () => {
      const targetAgent = SIM.debugMode
        ? SIM.population[0]
        : SIM.population.find((a: Agent) => a.formaDeNascimento === "elite") ||
          SIM.population[0];

      if (targetAgent && SIM.lastStepResult) {
        DOMManager.downloadDebugData(targetAgent, SIM.lastStepResult);
      } else {
        alert("Nenhum dado de debug disponível. Inicie a simulação primeiro.");
      }
    });

    UI.buttons.start.addEventListener("click", () => {
      SIM.running = true;
      UI.buttons.start.textContent = "Running";
      UI.buttons.pause.textContent = "Pause";
    });

    UI.buttons.pause.addEventListener("click", () => {
      SIM.running = false;
      UI.buttons.start.textContent = "Start";
      UI.buttons.pause.textContent = "Paused";
    });

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        SIM.running = !SIM.running;
        if (SIM.running) {
          UI.buttons.start.textContent = "Running";
          UI.buttons.pause.textContent = "Pause";
        } else {
          UI.buttons.start.textContent = "Start";
          UI.buttons.pause.textContent = "Paused";
        }
      }
      if (e.key === "n" || e.key === "N") {
        SIM.endGeneration();
        DOMManager.updateUI(SIM);
      }
    });

    requestAnimationFrame(loop);
  }

  function loop() {
    if (!SIM) {
      requestAnimationFrame(loop);
      return;
    }
    if (SIM.running) for (let i = 0; i < SIM.speed; i++) SIM.stepAll();
    Renderer.draw(SIM.world, SIM.population, SIM);
    DOMManager.updateUI(SIM); // Atualiza contador de pedras
    if (SIM.sanityFailed)
      Renderer.drawRedText(ctx, "Sanity check failed - reset required");
    requestAnimationFrame(loop);
  }

  setup();
  SIM.sanityCheck();
})();
