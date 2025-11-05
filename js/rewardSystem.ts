const RewardSystemImpl = {
  // Cache para médias da população
  _populationStats: { avgWrongMines: 0, avgExperience: 0 },

  // Configurações de recompensas
  REWARDS: {
    // Sucessos principais (aumentados drasticamente)
    STONE_PICKED: 2000,
    STONE_DELIVERED: 5000,

    // Ações corretas
    CORRECT_MINE_ATTEMPT: 2,
    CORRECT_DEPOSIT_ATTEMPT: 1,

    // Penalidades graduais adaptativas
    WRONG_MINE_BASE_PENALTY: -2,
    WRONG_MINE_EXPERIENCE_MULTIPLIER: 1.8,
    WRONG_DEPOSIT_BASE_PENALTY: -1,

    // Custos de imobilidade
    IMMOBILE_COST: -0.5,

    // Colisões
    BOUNDARY_COLLISION: -6,
    OBSTACLE_COLLISION: -8,

    // Bonus base
    ALIVE_BONUS: 0.01,

    // Bonus de retorno à base (muito aumentado)
    RETURN_TO_BASE_BONUS: 100,
    BASE_PROXIMITY_THRESHOLD: 80,
    CARRYING_BONUS: 10, // Novo: bonus contínuo por carregar
    EXPLORATION_BONUS: 20, // Novo: bonus por sair da base

    // Bonus de proximidade (aumentados)
    PROXIMITY_MULTIPLIER: {
      CARRYING_TO_BASE: 15,
      SEEKING_STONES: 5,
    },
  },

  /**
   * Atualiza estatísticas da população
   */
  updatePopulationStats(agents: Agent[]): void {
    const totalWrongMines = agents.reduce((sum, a) => sum + (a.wrongMineAttempts || 0), 0);
    const totalExperience = agents.reduce((sum, a) => sum + a.deliveries + (a.hasMinedBefore ? 1 : 0), 0);
    
    this._populationStats.avgWrongMines = totalWrongMines / agents.length;
    this._populationStats.avgExperience = totalExperience / agents.length;
  },

  /**
   * Calcula penalidade gradual + relativa à população
   */
  calculateAdaptivePenalty(agent: Agent, penaltyType: string): number {
    const experience = agent.deliveries + (agent.hasMinedBefore ? 1 : 0);
    
    switch (penaltyType) {
      case 'WRONG_MINE':
        // Penalidade gradual baseada na experiência
        const basePenalty = this.REWARDS.WRONG_MINE_BASE_PENALTY;
        const experienceMultiplier = Math.pow(this.REWARDS.WRONG_MINE_EXPERIENCE_MULTIPLIER, experience);
        
        // Penalidade relativa à população
        const agentWrongMines = agent.wrongMineAttempts || 0;
        const relativeFactor = agentWrongMines > this._populationStats.avgWrongMines ? 
          1 + (agentWrongMines - this._populationStats.avgWrongMines) * 0.5 : 0.5;
        
        return basePenalty * experienceMultiplier * relativeFactor;
      
      case 'WRONG_DEPOSIT':
        return this.REWARDS.WRONG_DEPOSIT_BASE_PENALTY * (1 + experience * 0.5);
      
      default:
        return 0;
    }
  },

  /**
   * Calcula fitness baseado nas ações do agente
   */
  calculateActionRewards(
    agent: Agent,
    actionInfo: ActionResult,
    world: World
  ): number {
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
        // Penalidade gradual - pioneiros são protegidos
        reward += this.calculateAdaptivePenalty(agent, 'WRONG_MINE');
      }
    }

    // Recompensas/penalidades por tentativas de depósito
    if (actionInfo.attemptedDeposit) {
      const nearBase = this._isNearBase(agent, world);
      if (nearBase && agent.carry) {
        reward += this.REWARDS.CORRECT_DEPOSIT_ATTEMPT;
      } else {
        reward += this.calculateAdaptivePenalty(agent, 'WRONG_DEPOSIT');
      }
    }

    return reward;
  },

  /**
   * Calcula penalidades por imobilidade
   */
  calculateImmobilityPenalty(agent: Agent): number {
    if (agent.state === "MINING" || agent.state === "DEPOSIT") {
      return this.REWARDS.IMMOBILE_COST;
    }
    return 0;
  },

  /**
   * Calcula bonus de retorno à base (melhorado)
   */
  calculateReturnToBaseBonus(agent: Agent, world: World): number {
    if (!agent.carry) return 0;
    
    const distToBase = this._distanceToBase(agent, world);
    const maxDist = Math.hypot(world.w, world.h);
    
    // Bonus contínuo e forte por carregar pedra em direção à base
    const proximityFactor = Math.max(0, 1 - (distToBase / maxDist));
    let bonus = proximityFactor * this.REWARDS.RETURN_TO_BASE_BONUS;
    
    // Bonus extra se muito perto da base
    if (distToBase <= this.REWARDS.BASE_PROXIMITY_THRESHOLD) {
      const nearnessFactor = 1 - (distToBase / this.REWARDS.BASE_PROXIMITY_THRESHOLD);
      bonus += nearnessFactor * this.REWARDS.RETURN_TO_BASE_BONUS * 3;
    }
    
    return bonus;
  },

  /**
   * Calcula bonus de proximidade (melhorado)
   */
  calculateProximityBonus(agent: Agent, world: World): number {
    let bonus = 0;
    
    if (agent.carry) {
      // Bonus por estar perto da base quando carregando
      const d = this._distanceToBase(agent, world);
      const normalizedDistance = d / Math.hypot(world.w, world.h);
      const proximityFactor = Math.max(0, 1 - normalizedDistance);
      bonus += proximityFactor * this.REWARDS.PROXIMITY_MULTIPLIER.CARRYING_TO_BASE;
      
      // Bonus contínuo por carregar pedra
      bonus += this.REWARDS.CARRYING_BONUS;
    } else {
      // Bonus por estar perto de pedras quando não carregando
      const nearestStoneDistance = this._findNearestStoneDistance(agent, world);
      if (nearestStoneDistance < Infinity) {
        const normalizedDistance = nearestStoneDistance / Math.hypot(world.w, world.h);
        const proximityFactor = Math.max(0, 1 - normalizedDistance);
        bonus += proximityFactor * this.REWARDS.PROXIMITY_MULTIPLIER.SEEKING_STONES;
      }
      
      // Bonus por exploração (sair da base)
      if (agent.hasLeftBase) {
        bonus += this.REWARDS.EXPLORATION_BONUS;
      }
    }
    
    return bonus;
  },

  /**
   * Calcula penalidades por colisões
   */
  calculateCollisionPenalty(collisionType: "boundary" | "obstacle"): number {
    switch (collisionType) {
      case "boundary":
        return this.REWARDS.BOUNDARY_COLLISION;
      case "obstacle":
        return this.REWARDS.OBSTACLE_COLLISION;
      default:
        return 0;
    }
  },

  /**
   * Calcula fitness para uso durante simulação (não final)
   */
  calculateTotalFitness(
    agent: Agent,
    actionInfo: ActionResult,
    world: World
  ): number {
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
    const stagePoints = this._calculateStagePoints(
      agent,
      actionInfo,
      world,
      stage
    );
    return stage * 10000 + Math.max(0, Math.min(9999, stagePoints));
  },

  /**
   * Determina o estágio do agente (0-5+) - sistema mais generoso
   */
  _calculateStage(agent: Agent): number {
    if (agent.deliveries >= 3) return 5; // Múltiplas entregas avançadas
    if (agent.deliveries >= 2) return 4; // Múltiplas entregas
    if (agent.deliveries === 1) return 3; // Uma entrega completa
    if (agent.carry && agent.hasMinedBefore) return 2; // Retornando com pedra
    if (agent.hasMinedBefore || agent.hasLeftBase) return 1; // Já minerou ou explorou
    return 0; // Ainda explorando
  },

  /**
   * Calcula pontos dentro do estágio atual
   */
  _calculateStagePoints(
    agent: Agent,
    actionInfo: ActionResult,
    world: World,
    stage: number
  ): number {
    let points = 0;

    // Recompensas por ações
    points += this.calculateActionRewards(agent, actionInfo, world);

    // Penalidade por imobilidade
    points += this.calculateImmobilityPenalty(agent);

    // Bonus de proximidade
    points += this.calculateProximityBonus(agent, world);

    // Bonus de retorno à base
    points += this.calculateReturnToBaseBonus(agent, world);
    
    // Bonus de memória (se disponível)
    if (typeof (window as any).MemorySystem !== 'undefined') {
      points += (window as any).MemorySystem.calculateMemoryBonus(agent, world);
    }

    // Bonus base por estar vivo
    points += this.REWARDS.ALIVE_BONUS;

    return points;
  },

  /**
   * Sistema multi-objetivo com normalização relativa
   */
  evaluatePopulation(agents: Agent[], world: World): Agent[] {
    // 0. Atualiza estatísticas da população para penalidades relativas
    this.updatePopulationStats(agents);
    
    // 1. Calcula métricas multi-objetivo
    const metrics = this._calculateMultiObjectiveMetrics(agents, world);
    
    // 2. Normaliza scores relativamente (z-score)
    const normalizedMetrics = this._normalizeMetrics(metrics);
    
    // 3. Aplica scores normalizados
    agents.forEach((agent, i) => {
      agent.detailedScore = normalizedMetrics[i];
    });
    
    // 4. Ranking Pareto + score agregado
    agents.sort((a, b) => this._compareMultiObjective(a, b));

    return agents;
  },

  /**
   * Calcula métricas multi-objetivo
   */
  _calculateMultiObjectiveMetrics(agents: Agent[], world: World): MultiObjectiveMetrics[] {
    return agents.map(agent => ({
      deliveries: agent.deliveries,
      efficiency: (agent.correctMineAttempts || 0) / Math.max(1, (agent.wrongMineAttempts || 0) + (agent.correctMineAttempts || 0)),
      exploration: agent.hasLeftBase ? 1 : 0,
      survival: Math.min(agent.age / 1000, 1),
      rawFitness: agent.fitness
    }));
  },

  /**
   * Normalização relativa (z-score)
   */
  _normalizeMetrics(metrics: MultiObjectiveMetrics[]): MultiObjectiveMetrics[] {
    const keys: (keyof MultiObjectiveMetrics)[] = ['deliveries', 'efficiency', 'exploration', 'survival'];
    const normalized: MultiObjectiveMetrics[] = metrics.map(() => ({} as MultiObjectiveMetrics));
    
    keys.forEach(key => {
      const values = metrics.map(m => m[key] as number);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const std = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length) || 1;
      
      values.forEach((val, i) => {
        (normalized[i][key] as number) = (val - mean) / std; // z-score
      });
    });
    
    return normalized;
  },

  /**
   * Comparação multi-objetivo (Pareto + agregado)
   */
  _compareMultiObjective(a: Agent, b: Agent): number {
    const scoreA = a.detailedScore;
    const scoreB = b.detailedScore;
    
    // 1. Prioridade: deliveries (absoluto)
    if (a.deliveries !== b.deliveries) {
      return b.deliveries - a.deliveries;
    }
    
    // 2. Score agregado normalizado
    const aggregateA = scoreA.efficiency + scoreA.exploration + scoreA.survival;
    const aggregateB = scoreB.efficiency + scoreB.exploration + scoreB.survival;
    
    return aggregateB - aggregateA;
  },



  /**
   * Calcula distância ao objetivo atual
   */
  _getTargetDistance(agent: Agent, world: World): number {
    if (agent.carry) {
      // Se carrega, objetivo é a base
      return this._distanceToBase(agent, world);
    } else {
      // Se não carrega, objetivo é pedra mais próxima
      return this._findNearestStoneDistance(agent, world);
    }
  },

  // Métodos auxiliares privados
  _findNearStone(agent: Agent, world: World): Stone | null {
    for (const s of world.stones) {
      if (
        s.quantity > 0 &&
        this._distance(agent.x, agent.y, s.x, s.y) < s.r + 12
      ) {
        return s;
      }
    }
    return null;
  },

  _isNearBase(agent: Agent, world: World): boolean {
    return (
      this._distance(agent.x, agent.y, world.base.x, world.base.y) <
      world.base.r + 14
    );
  },

  _distanceToBase(agent: Agent, world: World): number {
    return this._distance(agent.x, agent.y, world.base.x, world.base.y);
  },

  _findNearestStoneDistance(agent: Agent, world: World): number {
    let nearest = Infinity;
    for (const s of world.stones) {
      if (s.quantity > 0) {
        nearest = Math.min(nearest, this._distance(agent.x, agent.y, s.x, s.y));
      }
    }
    return nearest;
  },

  _distance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.hypot(x1 - x2, y1 - y2);
  },

  /**
   * Permite modificar recompensas dinamicamente
   */
  updateReward(rewardName: string, newValue: number): boolean {
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
  },
};

// Exporta para uso global
if (typeof window !== "undefined") {
  (window as any).RewardSystem = RewardSystemImpl;
}
