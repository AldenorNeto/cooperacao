// Sistema de Especialização - Trade-offs Evolutivos
import { AgentSpecialization, CooperativeAgent, TerrainZone } from './types.js';
import { COOPERATIVE_CONFIG } from './config.js';

export class SpecializationSystem {
  
  /**
   * Gera especialização aleatória com trade-offs
   */
  static generateRandomSpecialization(rng: any): AgentSpecialization {
    // Sistema de pontos limitados - força trade-offs
    const totalPoints = 4.0;
    let remainingPoints = totalPoints;
    
    // Distribui pontos aleatoriamente entre habilidades
    const miningSpeed = this.allocatePoints(rng, remainingPoints, 0.5, 1.5);
    remainingPoints -= miningSpeed;
    
    const carryCapacity = Math.floor(this.allocatePoints(rng, remainingPoints, 1, 3));
    remainingPoints -= carryCapacity;
    
    const movementSpeed = this.allocatePoints(rng, remainingPoints, 0.7, 1.3);
    remainingPoints -= movementSpeed;
    
    const sensorRange = 100 + remainingPoints * 50; // Usa pontos restantes
    
    return {
      miningSpeed,
      carryCapacity,
      movementSpeed,
      terrainAdaptation: this.generateTerrainAdaptation(rng, movementSpeed),
      sensorRange
    };
  }
  
  /**
   * Aloca pontos dentro de limites
   */
  private static allocatePoints(rng: any, available: number, min: number, max: number): number {
    const range = Math.min(max - min, available);
    return min + rng.float(0, range);
  }
  
  /**
   * Gera adaptação de terreno baseada na velocidade
   */
  private static generateTerrainAdaptation(rng: any, movementSpeed: number) {
    // Agentes rápidos são piores em terreno difícil
    const roughPenalty = movementSpeed > 1.0 ? 0.3 : 0.1;
    const narrowPenalty = movementSpeed > 1.0 ? 0.2 : 0.05;
    
    return {
      normal: rng.float(0.9, 1.1),
      rough: Math.max(0.3, 1.0 - roughPenalty - rng.float(0, 0.2)),
      narrow: Math.max(0.5, 1.0 - narrowPenalty - rng.float(0, 0.15))
    };
  }
  
  /**
   * Calcula eficiência de movimento em terreno específico
   */
  static calculateMovementEfficiency(
    agent: CooperativeAgent, 
    terrainType: 'normal' | 'rough' | 'narrow'
  ): number {
    const baseSpeed = agent.specialization.movementSpeed;
    const terrainMultiplier = agent.specialization.terrainAdaptation[terrainType];
    return baseSpeed * terrainMultiplier;
  }
  
  /**
   * Determina tipo de terreno na posição
   */
  static getTerrainType(x: number, y: number, terrainZones: TerrainZone[]): 'normal' | 'rough' | 'narrow' {
    for (const zone of terrainZones) {
      if (this.pointInRect(x, y, zone.area)) {
        return zone.type;
      }
    }
    return 'normal';
  }
  
  /**
   * Calcula eficiência de mineração
   */
  static calculateMiningEfficiency(agent: CooperativeAgent, stoneDifficulty: number): number {
    const baseEfficiency = agent.specialization.miningSpeed;
    const difficultyPenalty = Math.max(0.1, 1.0 - (stoneDifficulty - 1) * 0.3);
    return baseEfficiency * difficultyPenalty;
  }
  
  /**
   * Verifica se agente pode carregar mais pedras
   */
  static canCarryMore(agent: CooperativeAgent): boolean {
    return agent.carry.length < agent.specialization.carryCapacity;
  }
  
  /**
   * Calcula "fitness" da especialização para tarefa específica
   */
  static evaluateSpecializationFitness(
    specialization: AgentSpecialization,
    taskType: 'mining' | 'transport' | 'exploration',
    terrainType: 'normal' | 'rough' | 'narrow' = 'normal'
  ): number {
    switch (taskType) {
      case 'mining':
        return specialization.miningSpeed * 0.7 + specialization.carryCapacity * 0.3;
      
      case 'transport':
        const terrainEfficiency = specialization.terrainAdaptation[terrainType];
        return specialization.movementSpeed * 0.6 + 
               specialization.carryCapacity * 0.2 + 
               terrainEfficiency * 0.2;
      
      case 'exploration':
        return specialization.sensorRange * 0.4 + 
               specialization.movementSpeed * 0.4 + 
               specialization.terrainAdaptation.normal * 0.2;
      
      default:
        return 0;
    }
  }
  
  /**
   * Mutação da especialização (para evolução)
   */
  static mutateSpecialization(spec: AgentSpecialization, rng: any, strength: number = 0.1): AgentSpecialization {
    const mutated = { ...spec };
    
    // Mutação com conservação de trade-offs
    if (rng.float(0, 1) < 0.3) {
      const delta = rng.gaussian(0, strength);
      mutated.miningSpeed = Math.max(0.5, Math.min(1.5, mutated.miningSpeed + delta));
    }
    
    if (rng.float(0, 1) < 0.3) {
      const delta = rng.gaussian(0, strength);
      mutated.movementSpeed = Math.max(0.7, Math.min(1.3, mutated.movementSpeed + delta));
    }
    
    if (rng.float(0, 1) < 0.2) {
      mutated.carryCapacity = Math.max(1, Math.min(3, 
        mutated.carryCapacity + (rng.float(0, 1) < 0.5 ? -1 : 1)
      ));
    }
    
    return mutated;
  }
  
  // Utilitário
  private static pointInRect(x: number, y: number, rect: { x: number, y: number, w: number, h: number }): boolean {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }
}