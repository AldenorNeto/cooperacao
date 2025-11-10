// Tipo para a configuração de recompensas
interface ProximityMultipliers {
  CARRYING_TO_BASE: number;
  SEEKING_STONES: number;
}

interface RewardConfig {
  STONE_PICKED: number;
  STONE_DELIVERED: number;
  CORRECT_MINE_ATTEMPT: number;
  CORRECT_DEPOSIT_ATTEMPT: number;
  WRONG_MINE_BASE_PENALTY: number;
  WRONG_MINE_EXPERIENCE_MULTIPLIER: number;
  WRONG_DEPOSIT_BASE_PENALTY: number;
  IMMOBILE_COST: number;
  BOUNDARY_COLLISION: number;
  OBSTACLE_COLLISION: number;
  ALIVE_BONUS: number;
  RETURN_TO_BASE_BONUS: number;
  BASE_PROXIMITY_THRESHOLD: number;
  CARRYING_BONUS: number;
  EXPLORATION_BONUS: number;
  PROXIMITY_MULTIPLIER: ProximityMultipliers;
}

// Interface estendida incluindo helpers privados usados na implementação
interface RewardSystemFull extends RewardSystemInterface {
  // cache interno
  _populationStats: { avgWrongMines: number; avgExperience: number };

  REWARDS: RewardConfig;

  // helpers privados
  _findNearStone(agent: Agent, world: World): Stone | null;
  _isNearBase(agent: Agent, world: World): boolean;
  _distanceToBase(agent: Agent, world: World): number;
  _findNearestStoneDistance(agent: Agent, world: World): number;
  _distance(x1: number, y1: number, x2: number, y2: number): number;

  // multi-objetivo helpers
  _calculateStage(agent: Agent): number;
  _calculateStagePoints(
    agent: Agent,
    actionInfo: ActionResult,
    world: World,
    stage: number
  ): number;
  _calculateMultiObjectiveMetrics(
    agents: Agent[],
    world: World
  ): MultiObjectiveMetrics[];
  _normalizeMetrics(metrics: MultiObjectiveMetrics[]): MultiObjectiveMetrics[];
  _compareMultiObjective(a: Agent, b: Agent): number;
  _getTargetDistance(agent: Agent, world: World): number;

  // utilitários públicos já existentes (re-declarados para completude)
  updateReward(rewardName: string, newValue: number): boolean;
  getRewardConfig(): RewardConfig;
  calculateImmobilityPenalty(agent: Agent): number;
}

// Implementação tipada
const RewardSystemImpl: RewardSystemFull = {
  _populationStats: { avgWrongMines: 0, avgExperience: 0 },

  REWARDS: {
    STONE_PICKED: 2000,
    STONE_DELIVERED: 5000,
    CORRECT_MINE_ATTEMPT: 2,
    CORRECT_DEPOSIT_ATTEMPT: 1,
    WRONG_MINE_BASE_PENALTY: -2,
    WRONG_MINE_EXPERIENCE_MULTIPLIER: 1.8,
    WRONG_DEPOSIT_BASE_PENALTY: -1,
    IMMOBILE_COST: -0.5,
    BOUNDARY_COLLISION: -6,
    OBSTACLE_COLLISION: -8,
    ALIVE_BONUS: 0.01,
    RETURN_TO_BASE_BONUS: 100,
    BASE_PROXIMITY_THRESHOLD: 80,
    CARRYING_BONUS: 10,
    EXPLORATION_BONUS: 20,
    PROXIMITY_MULTIPLIER: {
      CARRYING_TO_BASE: 15,
      SEEKING_STONES: 5,
    },
  },

  updatePopulationStats(agents: Agent[]): void {
    const totalWrongMines = agents.reduce(
      (sum, a) => sum + (a.wrongMineAttempts || 0),
      0
    );
    const totalExperience = agents.reduce(
      (sum, a) => sum + a.deliveries + (a.hasMinedBefore ? 1 : 0),
      0
    );

    this._populationStats.avgWrongMines =
      totalWrongMines / Math.max(1, agents.length);
    this._populationStats.avgExperience =
      totalExperience / Math.max(1, agents.length);
  },

  calculateAdaptivePenalty(agent: Agent, penaltyType: string): number {
    const experience = agent.deliveries + (agent.hasMinedBefore ? 1 : 0);

    switch (penaltyType) {
      case "WRONG_MINE": {
        const basePenalty = this.REWARDS.WRONG_MINE_BASE_PENALTY;
        const experienceMultiplier = Math.pow(
          this.REWARDS.WRONG_MINE_EXPERIENCE_MULTIPLIER,
          experience
        );

        const agentWrongMines = agent.wrongMineAttempts || 0;
        const relativeFactor =
          agentWrongMines > this._populationStats.avgWrongMines
            ? 1 + (agentWrongMines - this._populationStats.avgWrongMines) * 0.5
            : 0.5;

        return basePenalty * experienceMultiplier * relativeFactor;
      }

      case "WRONG_DEPOSIT":
        return this.REWARDS.WRONG_DEPOSIT_BASE_PENALTY * (1 + experience * 0.5);

      default:
        return 0;
    }
  },

  calculateActionRewards(
    agent: Agent,
    actionInfo: ActionResult,
    world: World
  ): number {
    let reward = 0;

    if (actionInfo.justPicked) reward += this.REWARDS.STONE_PICKED;
    if (actionInfo.justDeposited) reward += this.REWARDS.STONE_DELIVERED;

    if (actionInfo.attemptedMine) {
      const nearStone = this._findNearStone(agent, world);
      if (nearStone && !agent.carry) {
        reward += this.REWARDS.CORRECT_MINE_ATTEMPT;
      } else {
        reward += this.calculateAdaptivePenalty(agent, "WRONG_MINE");
      }
    }

    if (actionInfo.attemptedDeposit) {
      const nearBase = this._isNearBase(agent, world);
      if (nearBase && agent.carry) {
        reward += this.REWARDS.CORRECT_DEPOSIT_ATTEMPT;
      } else {
        reward += this.calculateAdaptivePenalty(agent, "WRONG_DEPOSIT");
      }
    }

    return reward;
  },

  calculateImmobilityPenalty(agent: Agent): number {
    if (agent.state === "MINING" || agent.state === "DEPOSIT") {
      return this.REWARDS.IMMOBILE_COST;
    }
    return 0;
  },

  calculateReturnToBaseBonus(agent: Agent, world: World): number {
    if (!agent.carry) return 0;

    const distToBase = this._distanceToBase(agent, world);
    const maxDist = Math.hypot(world.w, world.h);

    const proximityFactor = Math.max(0, 1 - distToBase / maxDist);
    let bonus = proximityFactor * this.REWARDS.RETURN_TO_BASE_BONUS;

    if (distToBase <= this.REWARDS.BASE_PROXIMITY_THRESHOLD) {
      const nearnessFactor =
        1 - distToBase / this.REWARDS.BASE_PROXIMITY_THRESHOLD;
      bonus += nearnessFactor * this.REWARDS.RETURN_TO_BASE_BONUS * 3;
    }

    return bonus;
  },

  calculateProximityBonus(agent: Agent, world: World): number {
    let bonus = 0;

    if (agent.carry) {
      const d = this._distanceToBase(agent, world);
      const normalizedDistance = d / Math.hypot(world.w, world.h);
      const proximityFactor = Math.max(0, 1 - normalizedDistance);
      bonus +=
        proximityFactor * this.REWARDS.PROXIMITY_MULTIPLIER.CARRYING_TO_BASE;
      bonus += this.REWARDS.CARRYING_BONUS;
    } else {
      const nearestStoneDistance = this._findNearestStoneDistance(agent, world);
      if (nearestStoneDistance < Infinity) {
        const normalizedDistance =
          nearestStoneDistance / Math.hypot(world.w, world.h);
        const proximityFactor = Math.max(0, 1 - normalizedDistance);
        bonus +=
          proximityFactor * this.REWARDS.PROXIMITY_MULTIPLIER.SEEKING_STONES;
      }

      if (agent.hasLeftBase) bonus += this.REWARDS.EXPLORATION_BONUS;
    }

    return bonus;
  },

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

  calculateTotalFitness(
    agent: Agent,
    actionInfo: ActionResult,
    world: World
  ): number {
    if (actionInfo.attemptedMine) {
      const nearStone = this._findNearStone(agent, world);
      if (nearStone && !agent.carry) {
        agent.correctMineAttempts = (agent.correctMineAttempts || 0) + 1;
      } else {
        agent.wrongMineAttempts = (agent.wrongMineAttempts || 0) + 1;
      }
    }

    const stage = this._calculateStage(agent);
    const stagePoints = this._calculateStagePoints(
      agent,
      actionInfo,
      world,
      stage
    );
    return stage * 10000 + Math.max(0, Math.min(9999, stagePoints));
  },

  _calculateStage(agent: Agent): number {
    if (agent.deliveries >= 3) return 5;
    if (agent.deliveries >= 2) return 4;
    if (agent.deliveries === 1) return 3;
    if (agent.carry && agent.hasMinedBefore) return 2;
    if (agent.hasMinedBefore || agent.hasLeftBase) return 1;
    return 0;
  },

  _calculateStagePoints(
    agent: Agent,
    actionInfo: ActionResult,
    world: World,
    stage: number
  ): number {
    let points = 0;

    points += this.calculateActionRewards(agent, actionInfo, world);
    points += this.calculateImmobilityPenalty(agent);
    points += this.calculateProximityBonus(agent, world);
    points += this.calculateReturnToBaseBonus(agent, world);

    // MemorySystem é declarado no types.d.ts; usamos diretamente
    if (
      typeof MemorySystem !== "undefined" &&
      MemorySystem?.calculateMemoryBonus
    ) {
      points += MemorySystem.calculateMemoryBonus(agent, world);
    }

    points += this.REWARDS.ALIVE_BONUS;
    return points;
  },

  evaluatePopulation(agents: Agent[], world: World): Agent[] {
    this.updatePopulationStats(agents);

    const metrics = this._calculateMultiObjectiveMetrics(agents, world);
    const normalizedMetrics = this._normalizeMetrics(metrics);

    agents.forEach((agent, i) => {
      agent.detailedScore = normalizedMetrics[i];
    });

    agents.sort((a, b) => this._compareMultiObjective(a, b));
    return agents;
  },

  _calculateMultiObjectiveMetrics(
    agents: Agent[],
    world: World
  ): MultiObjectiveMetrics[] {
    return agents.map((agent) => ({
      deliveries: agent.deliveries,
      efficiency:
        (agent.correctMineAttempts || 0) /
        Math.max(
          1,
          (agent.wrongMineAttempts || 0) + (agent.correctMineAttempts || 0)
        ),
      exploration: agent.hasLeftBase ? 1 : 0,
      survival: Math.min(agent.age / 1000, 1),
      rawFitness: agent.fitness,
    }));
  },

  _normalizeMetrics(metrics: MultiObjectiveMetrics[]): MultiObjectiveMetrics[] {
    const keys: (keyof MultiObjectiveMetrics)[] = [
      "deliveries",
      "efficiency",
      "exploration",
      "survival",
    ];
    const normalized: MultiObjectiveMetrics[] = metrics.map(
      () => ({} as MultiObjectiveMetrics)
    );

    keys.forEach((key) => {
      const values = metrics.map((m) => m[key] as number);
      const mean =
        values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
      const std =
        Math.sqrt(
          values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
            Math.max(1, values.length)
        ) || 1;

      values.forEach((val, i) => {
        (normalized[i][key] as number) = (val - mean) / std;
      });
    });

    return normalized;
  },

  _compareMultiObjective(a: Agent, b: Agent): number {
    const scoreA = a.detailedScore!;
    const scoreB = b.detailedScore!;

    if (a.deliveries !== b.deliveries) return b.deliveries - a.deliveries;

    const aggregateA =
      (scoreA.efficiency || 0) +
      (scoreA.exploration || 0) +
      (scoreA.survival || 0);
    const aggregateB =
      (scoreB.efficiency || 0) +
      (scoreB.exploration || 0) +
      (scoreB.survival || 0);

    return aggregateB - aggregateA;
  },

  _getTargetDistance(agent: Agent, world: World): number {
    if (agent.carry) return this._distanceToBase(agent, world);
    return this._findNearestStoneDistance(agent, world);
  },

  _findNearStone(agent: Agent, world: World): Stone | null {
    for (const s of world.stones) {
      if (
        s.quantity > 0 &&
        this._distance(agent.x, agent.y, s.x, s.y) < s.r + 12
      )
        return s;
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

  updateReward(rewardName: string, newValue: number): boolean {
    if (this.REWARDS.hasOwnProperty(rewardName)) {
      (this.REWARDS[rewardName as keyof RewardConfig] as number) = newValue;
      return true;
    }
    return false;
  },

  getRewardConfig() {
    return { ...this.REWARDS };
  },
};

// Exporta para uso global
if (typeof window !== "undefined") {
  (window as any).RewardSystem = RewardSystemImpl;
}
