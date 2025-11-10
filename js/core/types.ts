// Core Types - Nova Arquitetura Cooperativa
// Tipos fundamentais limpos e extensíveis

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

// Especialização evolutiva com trade-offs
export interface AgentSpecialization {
  miningSpeed: number;      // 0.5-1.5 (velocidade de mineração)
  carryCapacity: number;    // 1-3 (pedras simultâneas)
  movementSpeed: number;    // 0.7-1.3 (velocidade base)
  terrainAdaptation: {
    normal: number;         // 0.8-1.2
    rough: number;          // 0.3-1.0 (áreas com obstáculos)
    narrow: number;         // 0.5-1.0 (passagens estreitas)
  };
  sensorRange: number;      // 100-200 (alcance dos sensores)
}

// Sistema de cooperação e handoff
export interface CooperationState {
  currentTask?: ResourceTask;
  partners: string[];       // IDs dos parceiros atuais
  handoffOffers: HandoffOffer[];
  reputation: number;       // Histórico de cooperação bem-sucedida
}

export interface ResourceTask {
  id: string;
  type: 'mining' | 'transport' | 'delivery';
  resourceId: string;
  contributors: TaskContributor[];
  startTime: number;
  estimatedEffort: number;
}

export interface TaskContributor {
  agentId: string;
  contribution: number;     // % do esforço total
  phase: 'mining' | 'transport' | 'delivery';
  efficiency: number;       // Quão bem executou
}

export interface HandoffOffer {
  fromAgent: string;
  toAgent: string;
  resourceId: string;
  estimatedBenefit: number;
  location: Point;
}

// Recursos com propriedades cooperativas
export interface CooperativeStone extends Circle {
  id: string;
  quantity: number;
  difficulty: number;       // 1-3 (agentes necessários para mineração eficiente)
  currentTask?: ResourceTask;
  discoveredBy?: string;
  decayTimer?: number;      // Recursos temporários
}

// Terrenos que afetam especialização
export interface TerrainZone {
  type: 'normal' | 'rough' | 'narrow';
  area: Rect;
  speedMultipliers: {
    normal: number;
    agile: number;
    heavy: number;
  };
}

// Agente com especialização e cooperação
export interface CooperativeAgent extends Point {
  id: string;
  a: number;                // ângulo
  v: number;                // velocidade
  
  // Estados e ações
  state: 'SEEK' | 'MINING' | 'TRANSPORT' | 'HANDOFF' | 'DEPOSIT';
  carry: CooperativeStone[];
  
  // Especialização evolutiva
  specialization: AgentSpecialization;
  
  // Sistema de cooperação
  cooperation: CooperationState;
  
  // Métricas e fitness
  fitness: number;
  delivered: number;
  age: number;
  trail: Point[];
  
  // Rede neural
  genome: any;
  
  // Métodos
  record(): void;
}

// Mundo com terrenos e recursos cooperativos
export interface CooperativeWorld {
  w: number;
  h: number;
  base: Circle;
  stones: CooperativeStone[];
  obstacles: Rect[];
  terrainZones: TerrainZone[];
  
  // Sistema de tarefas ativas
  activeTasks: Map<string, ResourceTask>;
  handoffZones: Circle[];   // Áreas onde handoffs são mais eficientes
}

// Resultado de ações com cooperação
export interface CooperativeActionResult {
  moved: boolean;
  mined: boolean;
  transported: boolean;
  handedOff: boolean;
  deposited: boolean;
  cooperated: boolean;
  efficiency: number;
}

// Configuração da simulação cooperativa
export interface CooperativeConfig {
  SPECIALIZATION: {
    MINING_SPEED_RANGE: [number, number];
    CARRY_CAPACITY_RANGE: [number, number];
    MOVEMENT_SPEED_RANGE: [number, number];
    SENSOR_RANGE_RANGE: [number, number];
    TERRAIN_ADAPTATION_RANGE: [number, number];
  };
  
  COOPERATION: {
    HANDOFF_DISTANCE: number;
    REPUTATION_DECAY: number;
    TASK_TIMEOUT: number;
    MIN_EFFICIENCY_GAIN: number;
  };
  
  TERRAIN: {
    ROUGH_ZONES: number;
    NARROW_PASSAGES: number;
    ZONE_SIZE_RANGE: [number, number];
  };
  
  RESOURCES: {
    DIFFICULTY_DISTRIBUTION: [number, number, number]; // % de pedras dificuldade 1,2,3
    DECAY_RATE: number;
    DISCOVERY_BONUS: number;
  };
}