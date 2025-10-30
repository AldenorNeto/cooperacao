// Sistema de Recompensas - Cooperação de Agentes
// Centraliza todos os cálculos de fitness e recompensas

const RewardSystem = {
  // Configurações de recompensas
  REWARDS: {
    // Sucessos principais
    STONE_PICKED: 400,
    STONE_DELIVERED: 1200,
    
    // Ações corretas
    CORRECT_MINE_ATTEMPT: 2,
    CORRECT_DEPOSIT_ATTEMPT: 1,
    
    // Penalidades por ações incorretas
    WRONG_MINE_ATTEMPT: -8,
    WRONG_DEPOSIT_ATTEMPT: -5,
    
    // Custos de imobilidade
    IMMOBILE_COST: -0.5,
    
    // Colisões
    BOUNDARY_COLLISION: -6,
    OBSTACLE_COLLISION: -8,
    
    // Bonus base
    ALIVE_BONUS: 0.01,
    
    // Bonus de proximidade
    PROXIMITY_MULTIPLIER: {
      CARRYING_TO_BASE: 2.5,
      SEEKING_STONES: 0.8
    }
  },

  /**
   * Calcula fitness baseado nas ações do agente
   */
  calculateActionRewards(agent, actionInfo, world) {
    let reward = 0;

    // Recompensas por sucessos
    if (actionInfo.justPicked) {
      reward += this.REWARDS.STONE_PICKED;
    }
    
    if (actionInfo.justDeposited) {
      reward += this.REWARDS.STONE_DELIVERED;
    }

    // Recompensas/penalidades por tentativas de mineração
    if (actionInfo.attemptedMine) {
      const nearStone = this._findNearStone(agent, world);
      if (nearStone && !agent.carry) {
        reward += this.REWARDS.CORRECT_MINE_ATTEMPT;
      } else {
        reward += this.REWARDS.WRONG_MINE_ATTEMPT;
      }
    }

    // Recompensas/penalidades por tentativas de depósito
    if (actionInfo.attemptedDeposit) {
      const nearBase = this._isNearBase(agent, world);
      if (nearBase && agent.carry) {
        reward += this.REWARDS.CORRECT_DEPOSIT_ATTEMPT;
      } else {
        reward += this.REWARDS.WRONG_DEPOSIT_ATTEMPT;
      }
    }

    return reward;
  },

  /**
   * Calcula penalidades por imobilidade
   */
  calculateImmobilityPenalty(agent) {
    if (agent.state === "MINING" || agent.state === "DEPOSIT") {
      return this.REWARDS.IMMOBILE_COST;
    }
    return 0;
  },

  /**
   * Calcula bonus de proximidade
   */
  calculateProximityBonus(agent, world) {
    if (agent.carry) {
      // Bonus por estar perto da base quando carregando
      const d = this._distanceToBase(agent, world);
      const normalizedDistance = d / Math.hypot(world.w, world.h);
      const proximityFactor = Math.max(0, 1 - normalizedDistance);
      return proximityFactor * this.REWARDS.PROXIMITY_MULTIPLIER.CARRYING_TO_BASE;
    } else {
      // Bonus por estar perto de pedras quando não carregando
      const nearestStoneDistance = this._findNearestStoneDistance(agent, world);
      if (nearestStoneDistance < Infinity) {
        const normalizedDistance = nearestStoneDistance / Math.hypot(world.w, world.h);
        const proximityFactor = Math.max(0, 1 - normalizedDistance);
        return proximityFactor * this.REWARDS.PROXIMITY_MULTIPLIER.SEEKING_STONES;
      }
    }
    return 0;
  },

  /**
   * Calcula penalidades por colisões
   */
  calculateCollisionPenalty(collisionType) {
    switch (collisionType) {
      case 'boundary':
        return this.REWARDS.BOUNDARY_COLLISION;
      case 'obstacle':
        return this.REWARDS.OBSTACLE_COLLISION;
      default:
        return 0;
    }
  },

  /**
   * Calcula fitness para uso durante simulação (não final)
   */
  calculateTotalFitness(agent, actionInfo, world) {
    // Rastreia tentativas para ranking
    if (actionInfo.attemptedMine) {
      const nearStone = this._findNearStone(agent, world);
      if (nearStone && !agent.carry) {
        agent.correctMineAttempts = (agent.correctMineAttempts || 0) + 1;
      } else {
        agent.wrongMineAttempts = (agent.wrongMineAttempts || 0) + 1;
      }
    }

    // Retorna fitness temporário (será substituído no ranking)
    const stage = this._calculateStage(agent);
    const stagePoints = this._calculateStagePoints(agent, actionInfo, world, stage);
    return stage * 10000 + Math.max(0, Math.min(9999, stagePoints));
  },

  /**
   * Determina o estágio do agente (0-4+)
   */
  _calculateStage(agent) {
    if (agent.deliveries >= 2) return 4; // Múltiplas entregas
    if (agent.deliveries === 1) return 3; // Uma entrega completa
    if (agent.carry && agent.hasMinedBefore) return 2; // Retornando com pedra
    if (agent.hasMinedBefore) return 1; // Já minerou
    return 0; // Ainda explorando
  },

  /**
   * Calcula pontos dentro do estágio atual
   */
  _calculateStagePoints(agent, actionInfo, world, stage) {
    let points = 0;

    // Recompensas por ações
    points += this.calculateActionRewards(agent, actionInfo, world);
    
    // Penalidade por imobilidade
    points += this.calculateImmobilityPenalty(agent);
    
    // Bonus de proximidade
    points += this.calculateProximityBonus(agent, world);
    
    // Bonus base por estar vivo
    points += this.REWARDS.ALIVE_BONUS;

    return points;
  },

  /**
   * Sistema de ranking granular preservando fitness real
   */
  evaluatePopulation(agents, world) {
    // Calcula score detalhado para cada agente
    agents.forEach(agent => {
      agent.detailedScore = this._calculateDetailedScore(agent, world);
    });

    // Ordena por critérios granulares mas preserva fitness real
    agents.sort((a, b) => this._compareAgents(a, b));

    return agents;
  },

  /**
   * Calcula score detalhado para ranking granular
   */
  _calculateDetailedScore(agent, world) {
    const score = {
      deliveries: agent.deliveries,
      hasMinedBefore: agent.hasMinedBefore ? 1 : 0,
      carry: agent.carry ? 1 : 0,
      distanceToTarget: this._getTargetDistance(agent, world),
      correctAttempts: agent.correctMineAttempts || 0,
      wrongAttempts: agent.wrongMineAttempts || 0,
      collisions: agent.collisions,
      age: agent.age
    };
    return score;
  },

  /**
   * Compara dois agentes para ranking granular
   */
  _compareAgents(a, b) {
    const scoreA = a.detailedScore;
    const scoreB = b.detailedScore;

    // 1. Entregas (prioridade máxima)
    if (scoreA.deliveries !== scoreB.deliveries) {
      return scoreB.deliveries - scoreA.deliveries;
    }

    // 2. Está carregando pedra
    if (scoreA.carry !== scoreB.carry) {
      return scoreB.carry - scoreA.carry;
    }

    // 3. Já minerou antes
    if (scoreA.hasMinedBefore !== scoreB.hasMinedBefore) {
      return scoreB.hasMinedBefore - scoreA.hasMinedBefore;
    }

    // 4. Distância ao objetivo (menor é melhor)
    if (Math.abs(scoreA.distanceToTarget - scoreB.distanceToTarget) > 5) {
      return scoreA.distanceToTarget - scoreB.distanceToTarget;
    }

    // 5. Tentativas corretas vs incorretas
    const ratioA = scoreA.correctAttempts / Math.max(1, scoreA.wrongAttempts + scoreA.correctAttempts);
    const ratioB = scoreB.correctAttempts / Math.max(1, scoreB.wrongAttempts + scoreB.correctAttempts);
    if (Math.abs(ratioA - ratioB) > 0.1) {
      return ratioB - ratioA;
    }

    // 6. Menos colisões
    if (scoreA.collisions !== scoreB.collisions) {
      return scoreA.collisions - scoreB.collisions;
    }

    // 7. Mais tempo vivo (exploração)
    return scoreB.age - scoreA.age;
  },

  /**
   * Calcula distância ao objetivo atual
   */
  _getTargetDistance(agent, world) {
    if (agent.carry) {
      // Se carrega, objetivo é a base
      return this._distanceToBase(agent, world);
    } else {
      // Se não carrega, objetivo é pedra mais próxima
      return this._findNearestStoneDistance(agent, world);
    }
  },

  // Métodos auxiliares privados
  _findNearStone(agent, world) {
    for (const s of world.stones) {
      if (s.quantity > 0 && this._distance(agent.x, agent.y, s.x, s.y) < s.r + 12) {
        return s;
      }
    }
    return null;
  },

  _isNearBase(agent, world) {
    return this._distance(agent.x, agent.y, world.base.x, world.base.y) < world.base.r + 14;
  },

  _distanceToBase(agent, world) {
    return this._distance(agent.x, agent.y, world.base.x, world.base.y);
  },

  _findNearestStoneDistance(agent, world) {
    let nearest = Infinity;
    for (const s of world.stones) {
      if (s.quantity > 0) {
        nearest = Math.min(nearest, this._distance(agent.x, agent.y, s.x, s.y));
      }
    }
    return nearest;
  },

  _distance(x1, y1, x2, y2) {
    return Math.hypot(x1 - x2, y1 - y2);
  },

  /**
   * Permite modificar recompensas dinamicamente
   */
  updateReward(rewardName, newValue) {
    if (this.REWARDS.hasOwnProperty(rewardName)) {
      this.REWARDS[rewardName] = newValue;
      return true;
    }
    return false;
  },

  /**
   * Retorna configuração atual de recompensas
   */
  getRewardConfig() {
    return { ...this.REWARDS };
  }
};

// Exporta para uso global
if (typeof window !== 'undefined') {
  window.RewardSystem = RewardSystem;
}