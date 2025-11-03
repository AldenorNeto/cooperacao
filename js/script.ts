(() => {
  const SEED: number | null = null;
  const CONFIG = {
    POPULATION: {
      LAMBDA: 99,
      MIN_SIZE: 50,
      MAX_SIZE: 300,
    },
    GENETIC: {
      SIGMA: 0.15,
    },
    SIMULATION: {
      GEN_SECONDS: 30,
      STEPS_PER_GEN: 1800,
      SPEED: 5,
      STEPS_PER_SECOND: 60,
      MIN_STEPS_PER_GEN: 50,
      TURBO_SPEED_MULTIPLIER: 10,
      MAX_TURBO_ITERATIONS: 500,
      MAX_POPULATION: 300,
      MIN_POPULATION: 50,
      STORAGE_KEY: "cooperacao_simulation",
    },
    AGENT: {
      TRAIL_LENGTH: 60,
      SENSOR_COUNT: 5,
      BASE_RADIUS: 18,
      MINE_TIMER_BASE: 30,
      DEPOSIT_TIMER_BASE: 15,
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
      INPUTS: 21,
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
    choose<T>(arr: T[]): T {
      return arr[this.int(arr.length)];
    }
  }

  const UI = DOMManager.init();
  const cvs: HTMLCanvasElement = UI.canvas;
  const ctx: CanvasRenderingContext2D = cvs.getContext("2d")!;

  let rng: RNG = new RNG(SEED);
  let SIM: Simulation | null = null;

  // Utilitários geométricos movidos para utils.js
  const {
    clamp,
    distance: dist,
    pointInRect,
    rectCircleOverlap,
    rayCircleIntersectT,
  } = GeometryUtils;

  class World {
    w: number;
    h: number;
    base: Base;
    stones: Stone[];
    obstacles: Rect[];


    constructor(w: number, h: number) {
      this.w = w;
      this.h = h;
      this.base = { x: w / 2, y: h / 2, r: CONFIG.AGENT.BASE_RADIUS };
      this.stones = [];
      this.obstacles = [];

    }


  }

  class Agent {
    x: number;
    y: number;
    a: number;
    v: number;
    state: "SEEK" | "MINING" | "DEPOSIT";
    carry: boolean;
    mineTimer: number;
    depositTimer: number;
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
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > CONFIG.AGENT.TRAIL_LENGTH) this.trail.shift();
    }
  }

  class Genome {
    sensorAngles: Float32Array;
    sensorRange: number;
    inputs: number;
    outputs: number;
    weights: Float32Array;
    biases: Float32Array;

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
      this.inputs = 21;
      this.outputs = CONFIG.GENOME.OUTPUTS;
      this.weights = new Float32Array(this.inputs * this.outputs);
      this.biases = new Float32Array(this.outputs);
      for (let i = 0; i < this.weights.length; i++)
        this.weights[i] = rng.gaussian(0, CONFIG.GENOME.WEIGHT_INIT_STD);
      for (let i = 0; i < this.biases.length; i++)
        this.biases[i] = rng.gaussian(0, CONFIG.GENOME.BIAS_INIT_STD);
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
    mutate(rng: RNG, sigma: number): Genome {
      const g = this.clone();
      for (let i = 0; i < g.sensorAngles.length; i++)
        g.sensorAngles[i] +=
          rng.gaussian(0, 1) * sigma * CONFIG.GENOME.MUTATION_SIGMA_FACTOR;
      g.sensorRange +=
        rng.gaussian(0, 1) * sigma * CONFIG.GENOME.MUTATION_RANGE_FACTOR;
      g.sensorRange = Math.max(CONFIG.GENOME.MIN_SENSOR_RANGE, g.sensorRange);
      for (let i = 0; i < g.weights.length; i++)
        g.weights[i] += rng.gaussian(0, 1) * sigma;
      for (let i = 0; i < g.biases.length; i++)
        g.biases[i] += rng.gaussian(0, 1) * sigma;
      return g;
    }
    feed(inputs: number[]): number[] {
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
    static deserialize(json: string): Genome {
      const o = JSON.parse(json);
      const g = Object.create(Genome.prototype);
      g.sensorAngles = new Float32Array(o.sensorAngles);
      g.sensorRange = o.sensorRange;
      g.inputs = 21;
      g.outputs = CONFIG.GENOME.OUTPUTS;
      g.weights = new Float32Array(o.weights);
      g.biases = new Float32Array(o.biases);
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

      // PRIMEIRO: Verifica depósito automático (independente da decisão da rede neural)
      if (
        agent.carry &&
        dist(agent.x, agent.y, world.base.x, world.base.y) <
          world.base.r + CONFIG.ACTIONS.DEPOSIT_DISTANCE
      ) {
        attemptedDeposit = true;
        agent.delivered++;
        agent.deliveries++;
        agent.carry = false;
        agent.state = "SEEK";
        justDeposited = true;
        return { justPicked, justDeposited, attemptedMine, attemptedDeposit };
      }

      // DEPOIS: Processa decisão de mineração da rede neural
      const wantsToMine = mineOut > CONFIG.ACTIONS.MINE_THRESHOLD;

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
          agent.state = "MINING";
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

    _findNearStone(agent: Agent, world: World): Stone | null {
      for (const s of world.stones) {
        if (
          s.quantity > 0 &&
          dist(agent.x, agent.y, s.x, s.y) <
            s.r + CONFIG.ACTIONS.STONE_PICKUP_DISTANCE
        ) {
          return s;
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
      // Agente só pode se mover se NÃO estiver minerando ou depositando
      if (agent.state === "MINING" || agent.state === "DEPOSIT") {
        // Completamente imóvel durante mineração/depósito
        agent.v = 0;
        return;
      }

      // Movimento normal apenas quando em estado SEEK
      agent.v =
        agent.v * CONFIG.PHYSICS.VELOCITY_DECAY +
        acc * maxSpeed * CONFIG.PHYSICS.ACCELERATION_FACTOR;
      agent.a += rot * CONFIG.PHYSICS.ROTATION_FACTOR;
      agent.x += Math.cos(agent.a) * agent.v * this.phy_dt;
      agent.y += Math.sin(agent.a) * agent.v * this.phy_dt;
    }

    _handleCollisions(agent: Agent, world: World): void {
      // Boundary collisions
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

      // Obstacle collisions - simplified repulsion
      for (const ob of world.obstacles) {
        if (pointInRect(agent.x, agent.y, ob)) {
          agent.x += (agent.x > ob.x + ob.w/2 ? 1 : -1) * CONFIG.PHYSICS.COLLISION_PUSH_DISTANCE;
          agent.y += (agent.y > ob.y + ob.h/2 ? 1 : -1) * CONFIG.PHYSICS.COLLISION_PUSH_DISTANCE;
          agent.collisions++;
          agent.fitness += RewardSystem.calculateCollisionPenalty("obstacle");
        }
      }
    }



    initWorld() {
      const w = this.canvas.width,
        h = this.canvas.height;
      this.world = new World(w, h);

      // Usa MapGenerator para criar o mundo
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
      ); // 3x mais pedras

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
      const lambda = clamp(
        this.lambda,
        this.minPopulation - 1,
        this.maxPopulation - 1
      );
      const popSize = 1 + lambda;
      console.log(
        `BuildPopulation: lambda=${lambda}, popSize=${popSize}, current=${this.population.length}`
      );

      if (this.population.length === 0) {
        // Limpa localStorage para debug
        localStorage.removeItem(this.storageKey);

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

        console.log(`Nova população criada: ${this.population.length} agentes`);
      }
    }

    adjustPopulationSize(targetSize: number): void {
      if (this.population.length === targetSize) return;

      if (this.population.length > targetSize) {
        // Remove agentes excedentes (mantém os melhores)
        this.population = this.population.slice(0, targetSize);
      } else {
        // Adiciona novos agentes baseados nos existentes
        while (this.population.length < targetSize) {
          const parent =
            this.population[rng.int(Math.min(5, this.population.length))];
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

    stepAll() {
      if (!this.sanityCheck()) return;
      const maxSpeed = CONFIG.PHYSICS.MAX_SPEED;
      this.genStepCount++;
      
      for (const agent of this.population) {
        const info = this.stepAgent(agent, agent.genome, this.world, maxSpeed);
        this._updateAgentFitness(agent, info);
        agent.age++;
        agent.record();
      }

      if (this.genStepCount >= this.stepsPerGen) this.endGeneration();
    }

    _updateAgentFitness(agent: Agent, info: ActionResult): void {
      // Usa o sistema de recompensas externo
      const reward = RewardSystem.calculateTotalFitness(
        agent,
        info,
        this.world
      );
      agent.fitness += reward;
    }

    endGeneration() {
      // Usa o novo sistema genético
      const evolutionResult = GeneticSystem.evolvePopulation(
        this.population,
        this.world,
        rng,
        Agent,
        Genome
      );

      this.population = evolutionResult.population;

      this.bestFitness = Math.round(evolutionResult.bestFitness * 100) / 100;
      this.bestDelivered = evolutionResult.bestDelivered;
      this.generation++;

      this.regenStones(this.population.length + 2);
      this.genStepCount = 0;

      // Salva estado atual
      this.saveToStorage();



      // Atualiza gráfico de fitness
      ChartManager.addFitnessPoint(
        this.generation,
        this.bestFitness,
        this.bestDelivered
      );

      // Debug do sistema genético
      if (this.debug) {
        const stats = GeneticSystem.getStats();
        console.log(
          `Gen ${this.generation}: Sigma=${stats.adaptiveSigma}, Diversity=${stats.diversity}, Stagnant=${stats.isStagnant}`
        );
      }
    }



    saveToStorage() {
      try {
        const saveData = {
          generation: this.generation,
          bestFitness: this.bestFitness,
          bestDelivered: this.bestDelivered,

          population: this.population.map((agent) => ({
            genome: agent.genome.serialize(),
            fitness: agent.fitness,
            delivered: agent.delivered,
          })),
          geneticState: GeneticSystem.state,
          timestamp: Date.now(),
        };
        localStorage.setItem(this.storageKey, JSON.stringify(saveData));
      } catch (e) {
        console.warn("Erro ao salvar simulação:", e);
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



        if (data.population && data.population.length > 0) {
          this.population = data.population.map((agentData) => {
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
          GeneticSystem.state = {
            ...GeneticSystem.state,
            ...data.geneticState,
          };
        }

        return true;
      } catch (e) {
        console.warn("Erro ao carregar simulação:", e);
        return false;
      }
    }

    clearStorage() {
      localStorage.removeItem(this.storageKey);
    }
  }

  // Funções de desenho movidas para renderer.js
  function draw(world: World, pop: Agent[], sim: Simulation): void {
    if (pop && pop.length > 0) {
      console.log(`Desenhando ${pop.length} agentes`);
    }
    Renderer.draw(world, pop, sim);
  }

  function setup() {
    resizeCanvas();
    initializeSimulation();
    setupInputs();

    ChartManager.init();
    setUIFromSim();
    SIM.initWorld();
    SIM.sanityCheck();
    attachEvents();
    requestAnimationFrame(loop);
  }

  function initializeSimulation() {
    SIM = new Simulation(cvs, ctx);
    SIM.lambda = CONFIG.POPULATION.LAMBDA;
    SIM.sigma = CONFIG.GENETIC.SIGMA;
    SIM.genSeconds = CONFIG.SIMULATION.GEN_SECONDS;
    SIM.stepsPerGen = CONFIG.SIMULATION.STEPS_PER_GEN;
    SIM.speed = CONFIG.SIMULATION.SPEED;
    (window as any).SIM = SIM;
  }

  function setupInputs() {
    // Inputs removidos - não há mais elementos para configurar
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
    UI.buttons.start.addEventListener("click", () => {
      console.log("Start clicked - População:", SIM.population.length);
      SIM.running = true;
    });
  }

  function attachInputEvents() {
    // Inputs removidos - valores fixos no CONFIG
  }

  function attachToggleEvents() {
    // Toggles removidos - valores fixos
    SIM.showSensors = false;
    SIM.showTrails = false;
    SIM.debug = false;
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
    SIM.lambda = CONFIG.POPULATION.LAMBDA;
    SIM.sigma = CONFIG.GENETIC.SIGMA;
    SIM.genSeconds = CONFIG.SIMULATION.GEN_SECONDS;
    SIM.stepsPerGen = CONFIG.SIMULATION.STEPS_PER_GEN;
    SIM.speed = CONFIG.SIMULATION.SPEED;
    SIM.clearStorage();
    SIM.initWorld();

    ChartManager.clearHistory();
    setUIFromSim();
  }

  function handleNextGeneration() {
    if (!SIM.sanityCheck()) return;
    SIM.endGeneration();
    setUIFromSim();
  }



  function setUIFromSim() {
    DOMManager.updateUI(SIM);

    // Atualiza gráfico se há dados
    if (SIM.generation > 0) {
      ChartManager.addFitnessPoint(
        SIM.generation,
        SIM.bestFitness,
        SIM.bestDelivered
      );
    }
  }

  function loop() {
    if (!SIM) {
      requestAnimationFrame(loop);
      return;
    }

    // Teste visual simples
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(50, 50, 100, 100);

    if (SIM.running) {
      for (let i = 0; i < SIM.speed; i++) SIM.stepAll();
    }
    draw(SIM.world, SIM.population, SIM);
    if (SIM.sanityFailed)
      Renderer.drawRedText(ctx, "Sanity check failed - reset required");

    // Atualiza labels sempre
    UI.labels.gen.innerText = SIM.generation;
    UI.labels.best.innerText = SIM.bestFitness;
    UI.labels.bestdel.innerText = SIM.bestDelivered;
    UI.labels.popSize.innerText = SIM.population.length;

    requestAnimationFrame(loop);
  }

  setup();

  SIM.sanityCheck();
})();
