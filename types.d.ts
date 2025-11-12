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
  initialQuantity: number; // Quantidade inicial para calcular tamanho visual
}

interface Agent extends Point {
  a: number; // angle
  v: number; // velocity
  state: "SEEK" | "MINING" | "CARRYING";
  mineTimer: number;

  memory: {
    angle: number;
    dist: number;
    lastPickupPosition?: Point;
    lastDeliveryCount?: number;
    lastSuccessfulReturnPath?: Point[];
  };
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
  detailedScore?: MultiObjectiveMetrics;
  hasLeftBase: boolean;
  formaDeNascimento?: "elite" | "mutacao" | "mesclagem" | "random";
  stepsCarrying: number;
  totalEfficiencyBonus: number;
  record(): void;
}

interface World {
  w: number;
  h: number;
  base: Base;
  stones: Stone[];
  obstacles: Rect[];
  stonesDelivered: number;
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
  mutate(rng: RNG, sigma: number): Genome;
  feed(inputs: number[]): number[];
  serialize(): string;
}

interface StoneHit {
  distance: number;
  stone: Stone | null;
  signal: number;
}

interface BaseHit {
  distance: number;
  signal: number;
}

interface SensorData {
  angle: number;
  range: number;
  obstacleDistance: number;
  stoneHit: StoneHit;
  baseHit: BaseHit;
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
  ELITE_PERCENTAGE: number;
  CROSSOVER_PERCENTAGE: number;
  MUTATION_PERCENTAGE: number;
  RANDOM_PERCENTAGE: number;

  CROSSOVER_RATE: number;
  MUTATION_STRENGTH_MIN: number;
  MUTATION_STRENGTH_MAX: number;

  DIVERSITY_THRESHOLD: number;
  STAGNATION_GENERATIONS: number;
}

// ----- Utilities / Global systems -----
declare const GeometryUtils: {
  clamp(v: number, a: number, b: number): number;
  distance(x1: number, y1: number, x2: number, y2: number): number;
  pointInRect(x: number, y: number, rect: Rect): boolean;
  rectCircleOverlap(rect: Rect, circle: Circle): boolean;
  rayCircleIntersectT(
    rx: number,
    ry: number,
    dx: number,
    dy: number,
    cx: number,
    cy: number,
    cr: number
  ): number | null;
  normalizeAngle(angle: number): number;
};

declare const SensorSystem: {
  calculateSensorData(agent: Agent, genome: Genome, world: World): SensorData[];
  extractInputs(sensorData: SensorData[], agent: Agent, world: World): number[];
  drawSensors(
    ctx: CanvasRenderingContext2D,
    agent: Agent,
    sensorData: SensorData[]
  ): void;
};

// ----- MemorySystem (declarado globalmente) -----
declare const MemorySystem: {
  calculateMemoryBonus(agent: Agent, world: World): number;
};

// ----- RNG / Constructors -----
interface RNG {
  int(max: number): number;
  rand(): number;
  float(min: number, max: number): number;
  gaussian(mean: number, std: number): number;
}

interface AgentConstructor {
  new (x: number, y: number, angle: number, genome: Genome): Agent;
}

interface GenomeConstructor {
  new (rng: RNG): Genome;
}

// ----- Population / multi-obj -----
interface PopulationStats {
  avgWrongMines: number;
  avgExperience: number;
}

interface MultiObjectiveMetrics {
  deliveries: number;
  efficiency: number;
  exploration: number;
  survival: number;
  rawFitness?: number;
}

// ----- Evolution result / genetic state -----
interface EvolutionResult {
  population: Agent[];
  champion: Genome;
  bestFitness: number;
  bestDelivered: number;
}

interface GeneticSystemState {
  stagnationCount: number;
  lastBestFitness: number;
  diversityHistory: number[];
  adaptiveSigma: number;
}

// ----- RewardSystem public interface -----
interface RewardSystemInterface {
  updatePopulationStats(agents: Agent[]): void;
  calculateAdaptivePenalty(agent: Agent, penaltyType: string): number;
  calculateActionRewards(
    agent: Agent,
    actionInfo: ActionResult,
    world: World
  ): number;
  calculateReturnToBaseBonus(agent: Agent, world: World): number;
  calculateProximityBonus(agent: Agent, world: World): number;
  calculateCollisionPenalty(collisionType: "boundary" | "obstacle"): number;
  calculateImmobilityPenalty(agent: Agent): number;
  calculateTotalFitness(
    agent: Agent,
    actionInfo: ActionResult,
    world: World
  ): number;
  evaluatePopulation(agents: Agent[], world: World): Agent[];
  updateReward(rewardName: string, newValue: number): boolean;
  getRewardConfig(): RewardConfig;
}

// ----- GeneticSystem public interface -----
interface GeneticSystemInterface {
  evolvePopulation(
    population: Agent[],
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor,
    GenomeClass: GenomeConstructor
  ): EvolutionResult;
  getStats(): {
    stagnationCount: number;
    adaptiveSigma: string;
    diversity: string;
    isStagnant: boolean;
  };
  state: GeneticSystemState;
}

// ----- ChartManager -----
interface FitnessPoint {
  generation: number;
  fitness: number;
  delivered: number;
  totalDelivered?: number;
  timestamp: number;
}

interface ChartManagerInterface {
  fitnessHistory: FitnessPoint[];
  maxHistory: number;
  storageKey: string;
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;

  init(): boolean;
  loadFromStorage?(): void;
  saveToStorage?(): void;
  addFitnessPoint(
    generation: number,
    fitness: number,
    delivered: number,
    totalDelivered?: number
  ): void;
  draw(): void;
  drawAxes(
    ctx: CanvasRenderingContext2D,
    padding: number,
    width: number,
    height: number,
    minGen: number,
    maxGen: number,
    minFit: number,
    maxFit: number
  ): void;
  drawFitnessLine(
    ctx: CanvasRenderingContext2D,
    padding: number,
    chartWidth: number,
    chartHeight: number,
    minGen: number,
    maxGen: number,
    minFit: number,
    maxFit: number
  ): void;
  drawDeliveryPoints(
    ctx: CanvasRenderingContext2D,
    padding: number,
    chartWidth: number,
    chartHeight: number,
    minGen: number,
    maxGen: number,
    minFit: number,
    maxFit: number
  ): void;
  drawTotalDeliveryLine(
    ctx: CanvasRenderingContext2D,
    padding: number,
    chartWidth: number,
    chartHeight: number,
    minGen: number,
    maxGen: number
  ): void;
}

// ----- DOMManager -----
interface DOMButtons {
  start: HTMLElement | null;
  pause: HTMLElement | null;
  reset: HTMLElement | null;
  save: HTMLElement | null;
  load: HTMLElement | null;
  debug: HTMLElement | null;
  downloadDebug: HTMLElement | null;
}

interface ConfigDisplayElements {
  pop: HTMLElement | null;
  sigma: HTMLElement | null;
  genTime: HTMLElement | null;
  speed: HTMLElement | null;
  stonesDelivered: HTMLElement | null;
}

interface LabelElements {
  best: HTMLElement | null;
  bestdel: HTMLElement | null;
  popSize: HTMLElement | null;
}

interface OtherElements {
  champJson: HTMLElement | null;
  champInfo: HTMLElement | null;
  debugBox: HTMLElement | null;
}

interface DOMElements {
  canvas: HTMLCanvasElement | null;
  buttons: DOMButtons;
  configDisplay: ConfigDisplayElements;
  labels: LabelElements;
  other: OtherElements;
}

/**
 * Tipagem enxuta da Simulation usada por UI/DOMManager.
 * Centralize aqui todos os campos que o DOM / Chart / Renderer usam.
 */
interface SimulationView {
  // properties commonly used by UI / DOMManager / ChartManager / Renderer
  canvas?: HTMLCanvasElement;
  ctx?: CanvasRenderingContext2D;
  phy_dt?: number;
  genSeconds?: number;
  stepsPerGen?: number;
  speed?: number;
  lambda?: number;
  sigma?: number;
  world?: World;
  generation: number;
  running?: boolean;
  showSensors?: boolean;
  showTrails?: boolean;
  debug?: boolean;
  debugMode?: boolean;
  lastStepResult?: StepResult | null;
  trackedAgent?: Agent | null;
  population: Agent[];
  maxPopulation?: number;
  minPopulation?: number;
  genStepCount: number;
  bestFitness: number;
  bestDelivered: number;
  sanityFailed?: boolean;
  storageKey?: string;
  // methods that DOMManager/others may call
  initWorld?(): void;
  endGeneration?(): void;
  regenStones?(minTotalQuantity: number): void;
  stepAll?(): void;
  sanityCheck?(): boolean;
  buildPopulation?(): void;
}

interface SimpleDOMElements {
  canvas: HTMLCanvasElement;
  buttons: {
    start: HTMLElement;
    pause: HTMLElement;
    reset: HTMLElement;
    debug: HTMLElement;
    downloadDebug: HTMLElement;
  };
  rangeControls: {
    speedRange: HTMLInputElement;
    speedValue: HTMLElement;
    genTimeRange: HTMLInputElement;
    genTimeValue: HTMLElement;
    stepsRange: HTMLInputElement;
    stepsValue: HTMLElement;
  };
  stonesDelivered: HTMLElement;
  debugPanel: HTMLElement;
  debugElements: {
    agentPos: HTMLElement;
    agentAngle: HTMLElement;
    agentVel: HTMLElement;
    agentState: HTMLElement;
    agentCarry: HTMLElement;
    agentFitness: HTMLElement;
    sensorValues: HTMLElement;
    networkInputs: HTMLElement;
    networkOutputs: HTMLElement;
    neuralCanvas: HTMLCanvasElement;
    historyCanvas: HTMLCanvasElement;
  };
}

interface HistoryPoint {
  step: number;
  agentAngle: number;
  memoryAngle: number;
  memoryDist: number;
}

interface DOMManagerInterface {
  elements: SimpleDOMElements | null;
  history: HistoryPoint[];
  maxHistoryPoints: number;
  sampleInterval: number;

  init(): SimpleDOMElements | null;
  resizeCanvas(): void;
  setupInputs(): void;
  updateUI(sim: Simulation): void;
  updateDebugInfo(agent: Agent, stepResult: StepResult): void;
  updateHistory(
    agent: Agent,
    stepResult: StepResult,
    currentStep: number
  ): void;
  drawHistoryChart(): void;
  clearHistory(): void;
  downloadDebugData(agent: Agent, stepResult: StepResult): void;
}

// ----- Simulation (completa o suficiente para tipagem) -----
interface Simulation {
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

  // principais métodos públicos usados pelo app
  stepAgent(
    agent: Agent,
    genome: Genome,
    world: World,
    maxSpeed: number
  ): StepResult;
  stepAll(): void;
  initWorld(): void;
  regenStones(minTotalQuantity: number): void;
  buildPopulation(): void;
  endGeneration(): void;
  sanityCheck(): boolean;
}

// ----- MapGenerator / Renderer globals -----
declare const MapGenerator: {
  generateBase(w: number, h: number, rng: RNG): Base;
  generateObstacles(w: number, h: number, base: Base, rng: RNG): Rect[];
  generateStones(
    w: number,
    h: number,
    base: Base,
    obstacles: Rect[],
    minTotalQuantity: number,
    rng: RNG
  ): Stone[];
  respawnStone(
    w: number,
    h: number,
    base: Base,
    obstacles: Rect[],
    existingStones: Stone[],
    initialQuantity: number,
    rng: RNG
  ): Stone | null;
};

declare const Renderer: {
  draw(
    world: World,
    population: Agent[],
    sim: SimulationView | Simulation
  ): void;
  drawRedText(ctx: CanvasRenderingContext2D, msg: string): void;
};

// ----- Config global -----
declare const CONFIG: {
  POPULATION: { LAMBDA: number; MIN_SIZE: number; MAX_SIZE: number };
  GENETIC: { SIGMA: number };
  SIMULATION: {
    GEN_SECONDS: number;
    STEPS_PER_GEN: number;
    SPEED: number;
    STEPS_PER_SECOND: number;
    MIN_STEPS_PER_GEN: number;
    TURBO_SPEED_MULTIPLIER: number;
    MAX_TURBO_ITERATIONS: number;
    MAX_POPULATION: number;
    MIN_POPULATION: number;
    STORAGE_KEY: string;
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
};

// ----- DebugSystem -----
interface DebugSystemInterface {
  isActive: boolean;
  toggle(sim: Simulation | SimulationView): void;
  reset(): void;
  updateAgentInfo(agent: Agent): void;
  updateSensorInfo(sensorData: SensorData[]): void;
  updateNetworkInfo(inputs: number[], outputs: number[]): void;
  drawNeuralNetwork(genome: Genome, inputs: number[], outputs: number[]): void;
  update(agent: Agent, stepResult: StepResult): void;
}

// ----- Extensões globais da Window -----
declare global {
  interface Window {
    DOMManager: DOMManagerInterface;
    ChartManager: ChartManagerInterface;
    RewardSystem: RewardSystemInterface;
    GeneticSystem: GeneticSystemInterface;
    DebugSystem: DebugSystemInterface;
    MapGenerator: typeof MapGenerator;
    GeometryUtils: typeof GeometryUtils;
    Renderer: typeof Renderer;
    MemorySystem: typeof MemorySystem;
    SensorSystem: typeof SensorSystem;
    SIM: Simulation | null;
    CONFIG: typeof CONFIG;
  }
}

// ----- Tipo auxiliar para substituir (window as any) -----
type WindowWithSystems = Window & {
  DOMManager: DOMManagerInterface;
  ChartManager: ChartManagerInterface;
  RewardSystem: RewardSystemInterface;
  GeneticSystem: GeneticSystemInterface;
  DebugSystem: DebugSystemInterface;
  MapGenerator: typeof MapGenerator;
  GeometryUtils: typeof GeometryUtils;
  Renderer: typeof Renderer;
  MemorySystem: typeof MemorySystem;
  SensorSystem: typeof SensorSystem;
  SIM: Simulation | null;
  CONFIG: typeof CONFIG;
};
// declare global singletons (para o TS aceitar usar DOMManager, ChartManager, etc. como identificadores)
declare const DOMManager: DOMManagerInterface;
declare const ChartManager: ChartManagerInterface;
declare const RewardSystem: RewardSystemInterface;
declare const GeneticSystem: GeneticSystemInterface;
declare const MapGenerator: {
  generateBase(w: number, h: number, rng: RNG): Base;
  generateObstacles(w: number, h: number, base: Base, rng: RNG): Rect[];
  generateStones(
    w: number,
    h: number,
    base: Base,
    obstacles: Rect[],
    minTotalQuantity: number,
    rng: RNG
  ): Stone[];
  respawnStone(
    w: number,
    h: number,
    base: Base,
    obstacles: Rect[],
    existingStones: Stone[],
    initialQuantity: number,
    rng: RNG
  ): Stone | null;
};

declare const Renderer: {
  draw(
    world: World,
    population: Agent[],
    sim: SimulationView | Simulation
  ): void;
  drawRedText(ctx: CanvasRenderingContext2D, msg: string): void;
};

declare const GeometryUtils: {
  clamp(v: number, a: number, b: number): number;
  distance(x1: number, y1: number, x2: number, y2: number): number;
  pointInRect(x: number, y: number, rect: Rect): boolean;
  rectCircleOverlap(rect: Rect, circle: Circle): boolean;
  rayCircleIntersectT(
    rx: number,
    ry: number,
    dx: number,
    dy: number,
    cx: number,
    cy: number,
    cr: number
  ): number | null;
  normalizeAngle(angle: number): number;
};

declare const MemorySystem: {
  calculateMemoryBonus(agent: Agent, world: World): number;
};

declare const CONFIG: {
  POPULATION: { LAMBDA: number; MIN_SIZE: number; MAX_SIZE: number };
  GENETIC: { SIGMA: number };
  SIMULATION: {
    GEN_SECONDS: number;
    STEPS_PER_GEN: number;
    SPEED: number;
    STEPS_PER_SECOND: number;
    MIN_STEPS_PER_GEN: number;
    TURBO_SPEED_MULTIPLIER: number;
    MAX_TURBO_ITERATIONS: number;
    MAX_POPULATION: number;
    MIN_POPULATION: number;
    STORAGE_KEY: string;
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
};

interface WindowType {
  ChartManager?: ChartManagerInterface;
  DebugSystem?: DebugSystemInterface;
  SIM?: Simulation | null;
  DOMManager?: DOMManagerInterface;
  MapGenerator?: typeof MapGenerator;
  MemorySystem?: typeof MemorySystem;
  Renderer?: typeof Renderer;
  RewardSystem?: RewardSystemInterface;
  SensorSystem?: typeof SensorSystem;
  GeometryUtils?: typeof GeometryUtils;
  CONFIG?: typeof CONFIG;
  GeneticSystem?: GeneticSystemInterface;
}
