// Sistema de recompensas simplificado e direto
const SimpleRewardSystem = {
  
  calculateTotalFitness(agent: any, actionInfo: any, world: any): number {
    let reward = 0;
    
    // Recompensas MASSIVAS por sucessos
    if (actionInfo.justPicked) {
      reward += 10000; // Pegou pedra = muito bom
    }
    
    if (actionInfo.justDeposited) {
      reward += 50000; // Entregou = excelente
    }
    
    // Penalidades por tentativas erradas
    if (actionInfo.attemptedMine && !actionInfo.justPicked) {
      reward -= 100; // Tentou minerar sem sucesso
    }
    
    if (actionInfo.attemptedDeposit && !actionInfo.justDeposited) {
      reward -= 50; // Tentou depositar sem sucesso
    }
    
    // Bonus por carregar pedra
    if (agent.carry) {
      reward += 10; // Bonus contínuo por carregar
      
      // Bonus ENORME por estar perto da base carregando
      const distToBase = Math.hypot(agent.x - world.base.x, agent.y - world.base.y);
      if (distToBase < world.base.r + 50) {
        reward += 500; // Muito perto da base com pedra
      }
    } else {
      // Bonus por estar perto de pedras quando não carregando
      let nearestStoneDistance = Infinity;
      for (const stone of world.stones) {
        if (stone.quantity > 0) {
          const dist = Math.hypot(agent.x - stone.x, agent.y - stone.y);
          nearestStoneDistance = Math.min(nearestStoneDistance, dist);
        }
      }
      
      if (nearestStoneDistance < 100) {
        reward += Math.max(0, 50 - nearestStoneDistance * 0.5);
      }
    }
    
    // Bonus por sair da base
    if (agent.hasLeftBase) {
      reward += 5;
    }
    
    // Penalidade por colisões
    reward -= agent.collisions * 10;
    
    // Bonus base por estar vivo
    reward += 1;
    
    return reward;
  },
  
  // Métodos de compatibilidade
  calculateCollisionPenalty(type: string): number {
    return type === "boundary" ? -20 : -30;
  },
  
  evaluatePopulation(agents: any[], world: any): any[] {
    // Ordenação simples por fitness
    return agents.sort((a, b) => b.fitness - a.fitness);
  },
  
  updatePopulationStats() {
    // Não faz nada - sistema simplificado
  },
  
  calculateAdaptivePenalty() {
    return 0;
  },
  
  calculateActionRewards() {
    return 0;
  },
  
  calculateReturnToBaseBonus() {
    return 0;
  },
  
  calculateProximityBonus() {
    return 0;
  }
};

// Substituir sistema complexo
if (typeof window !== "undefined") {
  (window as any).RewardSystem = SimpleRewardSystem;
}