interface GeneticSystemInterface {
  CONFIG: {
    ELITE_PERCENTAGE: number;
    CROSSOVER_PERCENTAGE: number;
    MUTATION_PERCENTAGE: number;
    MOMENTUM_PERCENTAGE: number;
    CROSSOVER_RATE: number;
    MUTATION_STRENGTH_MIN: number;
    MUTATION_STRENGTH_MAX: number;
    DIVERSITY_THRESHOLD: number;
    STAGNATION_GENERATIONS: number;
    TOURNAMENT_SIZE: number;
    SELECTION_PRESSURE: number;
    MIN_FITNESS_THRESHOLD: number;
  };

  state: {
    stagnationCount: number;
    lastBestFitness: number;
    diversityHistory: number[];
    adaptiveSigma: number;
    championHistory: Genome[];
  };

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

  _rankAndEvaluate(population: Agent[], world: World): Agent[];
  _filterWeakAgents(rankedAgents: Agent[]): Agent[];
  _selectParentProportional(parentPool: Agent[], rng: RNG): Agent;
  _selectParent(parentPool: Agent[], rng: RNG): Agent;

  _crossover(
    parent1: Agent,
    parent2: Agent,
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor,
    GenomeClass: GenomeConstructor
  ): Agent;

  _mutateAgent(
    parent: Agent,
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor
  ): Agent;

  _createMomentumMutant(
    elite: Agent,
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor
  ): Agent;

  _cloneAgent(
    parent: Agent,
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor
  ): Agent;

  _createRandomAgent(
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor,
    GenomeClass: GenomeConstructor
  ): Agent;

  _createAgentFromGenome(
    genome: Genome,
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor
  ): Agent;

  _calculateDiversity(population: Agent[]): number;
  _genomicDistance(genome1: Genome, genome2: Genome): number;
  _updateSystemState(currentBestFitness: number): void;
  _applyMomentumToWeights(
    targetWeights: Float32Array,
    championWeights: Float32Array[],
    rng: RNG
  ): void;
  _calculateMomentum(values: number[]): number;
}

const GeneticSystemImpl: GeneticSystemInterface = {
  CONFIG: {
    ELITE_PERCENTAGE: 0.08,
    CROSSOVER_PERCENTAGE: 0.6,
    MUTATION_PERCENTAGE: 0.27,
    MOMENTUM_PERCENTAGE: 0.05,
    CROSSOVER_RATE: 0.75,
    MUTATION_STRENGTH_MIN: 0.12,
    MUTATION_STRENGTH_MAX: 0.5,
    DIVERSITY_THRESHOLD: 0.1,
    STAGNATION_GENERATIONS: 8,
    TOURNAMENT_SIZE: 5,
    SELECTION_PRESSURE: 1.8,
    MIN_FITNESS_THRESHOLD: 0.15,
  },

  state: {
    stagnationCount: 0,
    lastBestFitness: 0,
    diversityHistory: [],
    adaptiveSigma: 0.12,
    championHistory: [],
  },

  evolvePopulation(
    currentPopulation: Agent[],
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor,
    GenomeClass: GenomeConstructor
  ): EvolutionResult {
    const rankedAgents = this._rankAndEvaluate(currentPopulation, world);
    const filteredAgents = this._filterWeakAgents(rankedAgents);
    const newPopulation: Agent[] = [];
    const popSize = currentPopulation.length;

    const eliteSize = Math.max(
      3,
      Math.floor(popSize * this.CONFIG.ELITE_PERCENTAGE)
    );
    const crossoverSize = Math.floor(
      popSize * this.CONFIG.CROSSOVER_PERCENTAGE
    );
    const mutationSize = Math.floor(popSize * this.CONFIG.MUTATION_PERCENTAGE);
    const momentumSize = popSize - eliteSize - crossoverSize - mutationSize;

    for (let i = 0; i < eliteSize; i++) {
      const elite = this._cloneAgent(filteredAgents[i], world, rng, AgentClass);
      elite.formaDeNascimento = "elite";
      newPopulation.push(elite);
    }

    for (let i = 0; i < crossoverSize; i++) {
      const parent1 = this._selectParentProportional(filteredAgents, rng);
      const parent2 = this._selectParentProportional(filteredAgents, rng);
      const child = this._crossover(
        parent1,
        parent2,
        world,
        rng,
        AgentClass,
        GenomeClass
      );
      child.formaDeNascimento = "mesclagem";
      newPopulation.push(child);
    }

    for (let i = 0; i < mutationSize; i++) {
      const parent = this._selectParentProportional(filteredAgents, rng);
      const mutant = this._mutateAgent(parent, world, rng, AgentClass);
      mutant.formaDeNascimento = "mutacao";
      newPopulation.push(mutant);
    }

    for (let i = 0; i < momentumSize; i++) {
      const momentumAgent = this._createMomentumMutant(
        filteredAgents[0],
        world,
        rng,
        AgentClass
      );
      momentumAgent.formaDeNascimento = "mutacao";
      newPopulation.push(momentumAgent);
    }

    this.state.championHistory.push(rankedAgents[0].genome.clone());
    if (this.state.championHistory.length > 4) {
      this.state.championHistory.shift();
    }

    this._updateSystemState(rankedAgents[0].fitness);

    return {
      population: newPopulation,
      champion: rankedAgents[0].genome.clone(),
      bestFitness: rankedAgents[0].fitness,
      bestDelivered: rankedAgents[0].delivered,
    };
  },

  _rankAndEvaluate(population: Agent[], world: World): Agent[] {
    const rankedAgents = RewardSystem.evaluatePopulation(population, world);
    const diversity = this._calculateDiversity(rankedAgents);
    this.state.diversityHistory.push(diversity);
    if (this.state.diversityHistory.length > 20) {
      this.state.diversityHistory.shift();
    }
    return rankedAgents;
  },

  _filterWeakAgents(rankedAgents: Agent[]): Agent[] {
    if (rankedAgents.length < 10) return rankedAgents;

    // Conta quantos agentes entregaram pelo menos 1 pedra
    const agentsWithDeliveries = rankedAgents.filter(
      (a) => a.deliveries > 0
    ).length;
    const percentageWithDeliveries = agentsWithDeliveries / rankedAgents.length;

    // Conta quantos agentes pelo menos COLETARAM (hasMinedBefore)
    const agentsWhoMined = rankedAgents.filter((a) => a.hasMinedBefore).length;
    const percentageWhoMined = agentsWhoMined / rankedAgents.length;

    // Se 5% ou mais entregaram, ELIMINA TODOS que não entregaram
    if (percentageWithDeliveries >= 0.05) {
      const filtered = rankedAgents.filter((a) => a.deliveries > 0);

      if (filtered.length >= 10) {
        return filtered;
      }
    }

    // Se 5% ou mais coletaram (mas não entregaram ainda), ELIMINA quem nem coletou
    if (percentageWhoMined >= 0.05 && agentsWithDeliveries === 0) {
      const filtered = rankedAgents.filter((a) => a.hasMinedBefore);

      if (filtered.length >= 10) {
        return filtered;
      }
    }

    // Fallback: filtro por fitness mínimo
    const avgFitness =
      rankedAgents.reduce((sum, a) => sum + a.fitness, 0) / rankedAgents.length;
    const minFitness = avgFitness * this.CONFIG.MIN_FITNESS_THRESHOLD;
    const filtered = rankedAgents.filter((a) => a.fitness >= minFitness);

    // Garante pelo menos 70% da população original
    return filtered.length >= Math.floor(rankedAgents.length * 0.7)
      ? filtered
      : rankedAgents.slice(0, Math.floor(rankedAgents.length * 0.85));
  },

  _selectParentProportional(parentPool: Agent[], rng: RNG): Agent {
    const fitnessScores = parentPool.map((a) =>
      Math.pow(a.fitness + 1, this.CONFIG.SELECTION_PRESSURE)
    );
    const totalFitness = fitnessScores.reduce((sum, f) => sum + f, 0);

    let random = rng.rand() * totalFitness;
    for (let i = 0; i < parentPool.length; i++) {
      random -= fitnessScores[i];
      if (random <= 0) return parentPool[i];
    }

    return parentPool[0];
  },

  _selectParent(parentPool: Agent[], rng: RNG): Agent {
    const tournamentSize = Math.min(
      this.CONFIG.TOURNAMENT_SIZE,
      parentPool.length
    );
    let best = parentPool[rng.int(parentPool.length)];

    for (let i = 1; i < tournamentSize; i++) {
      const candidate = parentPool[rng.int(parentPool.length)];
      if (candidate.fitness > best.fitness) {
        best = candidate;
      }
    }

    return best;
  },

  _crossover(
    parent1: Agent,
    parent2: Agent,
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor,
    GenomeClass: GenomeConstructor
  ): Agent {
    if (rng.rand() > this.CONFIG.CROSSOVER_RATE) {
      return this._cloneAgent(
        parent1.fitness > parent2.fitness ? parent1 : parent2,
        world,
        rng,
        AgentClass
      );
    }

    const genome1 = parent1.genome;
    const genome2 = parent2.genome;
    const childGenome = new GenomeClass(rng);

    // Crossover PONDERADO - pai melhor contribui mais
    const totalFitness = parent1.fitness + parent2.fitness + 0.01;
    const parent1Prob = (parent1.fitness + 0.01) / totalFitness;

    for (let i = 0; i < genome1.hiddenWeights.length; i++) {
      childGenome.hiddenWeights[i] =
        rng.rand() < parent1Prob
          ? genome1.hiddenWeights[i]
          : genome2.hiddenWeights[i];
    }

    for (let i = 0; i < genome1.hiddenBiases.length; i++) {
      childGenome.hiddenBiases[i] =
        rng.rand() < parent1Prob
          ? genome1.hiddenBiases[i]
          : genome2.hiddenBiases[i];
    }

    for (let i = 0; i < genome1.outputWeights.length; i++) {
      childGenome.outputWeights[i] =
        rng.rand() < parent1Prob
          ? genome1.outputWeights[i]
          : genome2.outputWeights[i];
    }

    for (let i = 0; i < genome1.outputBiases.length; i++) {
      childGenome.outputBiases[i] =
        rng.rand() < parent1Prob
          ? genome1.outputBiases[i]
          : genome2.outputBiases[i];
    }

    // Média ponderada nos sensores
    for (let i = 0; i < genome1.sensorAngles.length; i++) {
      childGenome.sensorAngles[i] =
        genome1.sensorAngles[i] * parent1Prob +
        genome2.sensorAngles[i] * (1 - parent1Prob);
    }
    childGenome.sensorRange =
      genome1.sensorRange * parent1Prob +
      genome2.sensorRange * (1 - parent1Prob);

    // Mutação leve no filho
    const lightMutation = this.state.adaptiveSigma * 0.3;
    for (let i = 0; i < childGenome.hiddenWeights.length; i++) {
      childGenome.hiddenWeights[i] += rng.gaussian(0, lightMutation);
    }
    for (let i = 0; i < childGenome.outputWeights.length; i++) {
      childGenome.outputWeights[i] += rng.gaussian(0, lightMutation);
    }

    return this._createAgentFromGenome(childGenome, world, rng, AgentClass);
  },

  _mutateAgent(
    parent: Agent,
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor
  ): Agent {
    const mutatedGenome = parent.genome.mutate(rng, this.state.adaptiveSigma);
    return this._createAgentFromGenome(mutatedGenome, world, rng, AgentClass);
  },

  _createMomentumMutant(
    elite: Agent,
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor
  ): Agent {
    if (this.state.championHistory.length < 2) {
      // Não há histórico suficiente, faz mutação normal
      return this._mutateAgent(elite, world, rng, AgentClass);
    }

    const mutatedGenome = elite.genome.clone();
    const champions = this.state.championHistory;

    // Escolhe aleatoriamente qual parte do genoma analisar
    const genomePartChoice = rng.int(4);

    if (genomePartChoice === 0) {
      // Analisa hidden weights
      this._applyMomentumToWeights(
        mutatedGenome.hiddenWeights,
        champions.map((c) => c.hiddenWeights),
        rng
      );
    } else if (genomePartChoice === 1) {
      // Analisa output weights
      this._applyMomentumToWeights(
        mutatedGenome.outputWeights,
        champions.map((c) => c.outputWeights),
        rng
      );
    } else if (genomePartChoice === 2) {
      // Analisa hidden biases
      this._applyMomentumToWeights(
        mutatedGenome.hiddenBiases,
        champions.map((c) => c.hiddenBiases),
        rng
      );
    } else {
      // Analisa sensores
      for (let i = 0; i < mutatedGenome.sensorAngles.length; i++) {
        const values = champions.map((c) => c.sensorAngles[i]);
        const momentum = this._calculateMomentum(values);
        mutatedGenome.sensorAngles[i] += momentum * 2.0; // Exagera a tendência
      }

      const rangeValues = champions.map((c) => c.sensorRange);
      const rangeMomentum = this._calculateMomentum(rangeValues);
      mutatedGenome.sensorRange += rangeMomentum * 2.0;
      mutatedGenome.sensorRange = Math.max(30, mutatedGenome.sensorRange);
    }

    return this._createAgentFromGenome(mutatedGenome, world, rng, AgentClass);
  },

  _applyMomentumToWeights(
    targetWeights: Float32Array,
    championWeights: Float32Array[],
    rng: RNG
  ): void {
    // Escolhe aleatoriamente alguns pesos para aplicar momentum
    const numWeightsToMutate = Math.min(
      20,
      Math.floor(targetWeights.length * 0.1)
    );

    for (let i = 0; i < numWeightsToMutate; i++) {
      const idx = rng.int(targetWeights.length);
      const values = championWeights.map((w) => w[idx]);
      const momentum = this._calculateMomentum(values);
      targetWeights[idx] += momentum * 2.0; // Exagera a tendência
    }
  },

  _calculateMomentum(values: number[]): number {
    if (values.length < 2) return 0;

    // Calcula a tendência linear (regressão simples)
    let sumDelta = 0;
    for (let i = 1; i < values.length; i++) {
      sumDelta += values[i] - values[i - 1];
    }

    return sumDelta / (values.length - 1);
  },

  _cloneAgent(
    parent: Agent,
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor
  ): Agent {
    const clonedGenome = parent.genome.clone();
    return this._createAgentFromGenome(clonedGenome, world, rng, AgentClass);
  },

  _createRandomAgent(
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor,
    GenomeClass: GenomeConstructor
  ): Agent {
    const randomGenome = new GenomeClass(rng);
    return this._createAgentFromGenome(randomGenome, world, rng, AgentClass);
  },

  _createAgentFromGenome(
    genome: Genome,
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor
  ): Agent {
    return new AgentClass(
      world.base.x + world.base.r + 6 + rng.float(-6, 6),
      world.base.y + rng.float(-6, 6),
      rng.float(0, Math.PI * 2),
      genome
    );
  },

  _calculateDiversity(population: Agent[]): number {
    if (population.length < 2) return 0;

    let totalDistance = 0;
    let comparisons = 0;

    for (let i = 0; i < Math.min(10, population.length); i++) {
      for (let j = i + 1; j < Math.min(10, population.length); j++) {
        const dist = this._genomicDistance(
          population[i].genome,
          population[j].genome
        );
        totalDistance += dist;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalDistance / comparisons : 0;
  },

  _genomicDistance(genome1: Genome, genome2: Genome): number {
    let distance = 0;
    const sampleSize = Math.min(50, genome1.hiddenWeights.length);

    for (let i = 0; i < sampleSize; i++) {
      const diff = genome1.hiddenWeights[i] - genome2.hiddenWeights[i];
      distance += diff * diff;
    }

    return Math.sqrt(distance / sampleSize);
  },

  _updateSystemState(currentBestFitness: number): void {
    if (currentBestFitness <= this.state.lastBestFitness + 0.01) {
      this.state.stagnationCount++;
    } else {
      this.state.stagnationCount = 0;
    }

    this.state.lastBestFitness = currentBestFitness;

    if (this.state.stagnationCount > this.CONFIG.STAGNATION_GENERATIONS) {
      this.state.adaptiveSigma = Math.min(
        this.CONFIG.MUTATION_STRENGTH_MAX,
        this.state.adaptiveSigma * 1.3
      );
    } else {
      this.state.adaptiveSigma = Math.max(
        this.CONFIG.MUTATION_STRENGTH_MIN,
        this.state.adaptiveSigma * 0.995
      );
    }

    const avgDiversity =
      this.state.diversityHistory.length > 0
        ? this.state.diversityHistory.reduce((a, b) => a + b) /
          this.state.diversityHistory.length
        : 1;

    if (avgDiversity < this.CONFIG.DIVERSITY_THRESHOLD) {
      this.state.adaptiveSigma = Math.min(
        this.CONFIG.MUTATION_STRENGTH_MAX,
        this.state.adaptiveSigma * 1.05
      );
    }
  },

  getStats(): {
    stagnationCount: number;
    adaptiveSigma: string;
    diversity: string;
    isStagnant: boolean;
  } {
    const avgDiversity =
      this.state.diversityHistory.length > 0
        ? this.state.diversityHistory.reduce((a, b) => a + b) /
          this.state.diversityHistory.length
        : 0;

    return {
      stagnationCount: this.state.stagnationCount,
      adaptiveSigma: this.state.adaptiveSigma.toFixed(3),
      diversity: avgDiversity.toFixed(3),
      isStagnant:
        this.state.stagnationCount > this.CONFIG.STAGNATION_GENERATIONS,
    };
  },
};

if (typeof window !== "undefined") {
  (
    window as unknown as Window & { GeneticSystem: GeneticSystemInterface }
  ).GeneticSystem = GeneticSystemImpl;
}
