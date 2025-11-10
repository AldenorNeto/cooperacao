// Configuração Central - Sistema Cooperativo
import { CooperativeConfig } from './types.js';

export const COOPERATIVE_CONFIG: CooperativeConfig = {
  SPECIALIZATION: {
    MINING_SPEED_RANGE: [0.5, 1.5],
    CARRY_CAPACITY_RANGE: [1, 3],
    MOVEMENT_SPEED_RANGE: [0.7, 1.3],
    SENSOR_RANGE_RANGE: [100, 200],
    TERRAIN_ADAPTATION_RANGE: [0.3, 1.2]
  },
  
  COOPERATION: {
    HANDOFF_DISTANCE: 25,
    REPUTATION_DECAY: 0.99,
    TASK_TIMEOUT: 300,
    MIN_EFFICIENCY_GAIN: 0.15
  },
  
  TERRAIN: {
    ROUGH_ZONES: 3,
    NARROW_PASSAGES: 2,
    ZONE_SIZE_RANGE: [80, 150]
  },
  
  RESOURCES: {
    DIFFICULTY_DISTRIBUTION: [0.6, 0.3, 0.1], // 60% fácil, 30% médio, 10% difícil
    DECAY_RATE: 0.002,
    DISCOVERY_BONUS: 50
  }
};

// Configurações físicas básicas
export const PHYSICS_CONFIG = {
  MAX_SPEED: 2.5,
  VELOCITY_DECAY: 0.85,
  ACCELERATION_FACTOR: 0.15,
  ROTATION_FACTOR: 0.08,
  COLLISION_VELOCITY_FACTOR: 0.3,
  BOUNDARY_MARGIN: 10
};

// Configurações de simulação
export const SIMULATION_CONFIG = {
  STEPS_PER_SECOND: 60,
  POPULATION_SIZE: 30,
  GENERATION_STEPS: 1800, // 30 segundos
  MUTATION_RATE: 0.1,
  CROSSOVER_RATE: 0.7
};