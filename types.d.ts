// Definições de Tipos - Cooperação de Agentes
// Tipagem TypeScript para melhor desenvolvimento

interface Point {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Circle {
  x: number;
  y: number;
  r: number;
}

interface Base extends Circle {}

interface Stone extends Circle {
  quantity: number;
}

interface Agent extends Point {
  a: number; // angle
  v: number; // velocity
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
  genome: Genome;
  id: number;
  lastSeen?: { angle: number | null; dist: number | null };
  sensorData?: SensorData[];
  correctMineAttempts?: number;
  wrongMineAttempts?: number;
  detailedScore?: any;
  hasLeftBase: boolean;
  record(): void;
}

interface World {
  w: number;
  h: number;
  base: Base;
  stones: Stone[];
  obstacles: Rect[];
}

interface Genome {
  sensorAngles: Float32Array;
  sensorRange: number;
  inputs: number;
  hidden: number;
  outputs: number;
  hiddenWeights: Float32Array;
  hiddenBiases: Float32Array;
  outputWeights: Float32Array;
  outputBiases: Float32Array;
  clone(): Genome;
  mutate(rng: any, sigma: number): Genome;
  feed(inputs: number[]): number[];
  serialize(): string;
}

interface SensorData {
  angle: number;
  range: number;
  obstacleDistance: number;
  stoneHit: {
    distance: number;
    stone: Stone | null;
    signal: number;
  };
  baseHit: {
    distance: number;
    signal: number;
  };
  endDistance: number;
  proximity: number;
  stoneSignal: number;
  baseSignal: number;
}

interface ActionResult {
  justPicked: boolean;
  justDeposited: boolean;
  attemptedMine: boolean;
  attemptedDeposit: boolean;
}

interface StepResult extends ActionResult {
  inputs: number[];
  outputs: number[];
}

interface Config {
  DEFAULTS: {
    popSizeLambda: number;
    sigma: number;
    genSeconds: number;
    stepsPerGen: number;
    speed: number;
  };
  AGENT: {
    TRAIL_LENGTH: number;
    SENSOR_COUNT: number;
    BASE_RADIUS: number;
    MINE_TIMER_BASE: number;
    DEPOSIT_TIMER_BASE: number;
  };
  PHYSICS: {
    MAX_SPEED: number;
    VELOCITY_DECAY: number;
    ACCELERATION_FACTOR: number;
    ROTATION_FACTOR: number;
    COLLISION_VELOCITY_FACTOR: number;
    COLLISION_PUSH_DISTANCE: number;
    BOUNDARY_MARGIN: number;
  };

  SIMULATION: {
    MAX_POPULATION: number;
    MIN_POPULATION: number;
    STORAGE_KEY: string;
    STEPS_PER_SECOND: number;
    MIN_STEPS_PER_GEN: number;
    TURBO_SPEED_MULTIPLIER: number;
    MAX_TURBO_ITERATIONS: number;
  };
  GENOME: {
    INPUTS: number;
    HIDDEN: number;
    OUTPUTS: number;
    SENSOR_ANGLE_BASE: number;
    SENSOR_ANGLE_VARIATION: number;
    SENSOR_RANGE_MIN: number;
    SENSOR_RANGE_MAX: number;
    WEIGHT_INIT_STD: number;
    BIAS_INIT_STD: number;
    MUTATION_SIGMA_FACTOR: number;
    MUTATION_RANGE_FACTOR: number;
    MIN_SENSOR_RANGE: number;
  };
  ACTIONS: {
    MINE_THRESHOLD: number;
    DEPOSIT_DISTANCE: number;
    STONE_PICKUP_DISTANCE: number;
    RANDOM_ROTATION: number;
  };
}

// Sistemas Globais
declare const GeometryUtils: {
  clamp(v: number, a: number, b: number): number;
  distance(x1: number, y1: number, x2: number, y2: number): number;
  pointInRect(x: number, y: number, rect: Rect): boolean;
  rectCircleOverlap(rect: Rect, circle: Circle): boolean;
  rayCircleIntersectT(rx: number, ry: number, dx: number, dy: number, cx: number, cy: number, cr: number): number | null;
};

declare const SensorSystem: {
  calculateSensorData(agent: Agent, genome: Genome, world: World): SensorData[];
  extractInputs(sensorData: SensorData[], agent: Agent, world: World): number[];
  drawSensors(ctx: CanvasRenderingContext2D, agent: Agent, sensorData: SensorData[]): void;
};

declare const RewardSystem: {
  calculateTotalFitness(agent: Agent, actionInfo: ActionResult, world: World): number;
  calculateCollisionPenalty(collisionType: 'boundary' | 'obstacle'): number;
  evaluatePopulation(agents: Agent[], world: World): Agent[];
};

declare const GeneticSystem: {
  evolvePopulation(population: Agent[], world: World, rng: any, AgentClass: any, GenomeClass: any): {
    population: Agent[];
    bestFitness: number;
    bestDelivered: number;
  };
  getStats(): {
    stagnationCount: number;
    adaptiveSigma: string;
    diversity: string;
    isStagnant: boolean;
  };
  state: any;
};

declare const MapGenerator: {
  generateBase(w: number, h: number, rng: any): Base;
  generateObstacles(w: number, h: number, base: Base, rng: any): Rect[];
  generateStones(w: number, h: number, base: Base, obstacles: Rect[], minTotalQuantity: number, rng: any): Stone[];
};

declare const Renderer: {
  draw(world: World, population: Agent[], sim: any): void;
  drawRedText(ctx: CanvasRenderingContext2D, msg: string): void;
};

declare const DOMManager: {
  init(): any;
  resizeCanvas(): void;
  updateUI(sim: any): void;
  setupInputs(sim: any): void;
};



declare const ChartManager: {
  init(): void;
  addFitnessPoint(generation: number, fitness: number, delivered: number): void;
  clearHistory(): void;
};

declare const CONFIG: Config;

// Extensão da interface Window para incluir SIM
declare global {
  interface Window {
    SIM: any;

  }
}