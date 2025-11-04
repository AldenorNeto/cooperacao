const GeneticSystemImpl = {
  // Configurações do sistema genético
  CONFIG: {
    ELITE_PERCENTAGE: 0.15, // 15% dos melhores são preservados
    CROSSOVER_PERCENTAGE: 0.6, // 60% da nova população vem de cruzamento
    MUTATION_PERCENTAGE: 0.2, // 20% são mutações puras
    RANDOM_PERCENTAGE: 0.05, // 5% são completamente aleatórios

    CROSSOVER_RATE: 0.7, // Probabilidade de cruzamento vs clonagem
    MUTATION_STRENGTH_MIN: 0.05, // Mutação mínima
    MUTATION_STRENGTH_MAX: 0.3, // Mutação máxima

    DIVERSITY_THRESHOLD: 0.1, // Limite para detectar baixa diversidade
    STAGNATION_GENERATIONS: 10, // Gerações sem melhoria = estagnação
  },

  // Estado do sistema
  state: {
    stagnationCount: 0,
    lastBestFitness: 0,
    diversityHistory: [] as number[],
    adaptiveSigma: 0.12,
  },

  /**
   * Gera nova população baseada na atual
   */
  evolvePopulation(
    currentPopulation: Agent[],
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor,
    GenomeClass: GenomeConstructor
  ): EvolutionResult {
    const rankedAgents = this._rankAndEvaluate(currentPopulation, world);
    const newPopulation: Agent[] = [];
    const popSize = currentPopulation.length;

    // Calcula tamanhos dos grupos - sempre preserva top 5
    const eliteSize = Math.max(
      5,
      Math.floor(popSize * this.CONFIG.ELITE_PERCENTAGE)
    );
    const crossoverSize = Math.floor((popSize - eliteSize) * 0.7);
    const mutationSize = Math.floor((popSize - eliteSize) * 0.25);
    const randomSize = popSize - eliteSize - crossoverSize - mutationSize;

    // 1. Preserva elite (sempre top 5 no mínimo)
    for (let i = 0; i < eliteSize; i++) {
      newPopulation.push(
        this._cloneAgent(rankedAgents[i], world, rng, AgentClass)
      );
    }

    // 2. Cruzamento entre os melhores
    const parentPool = rankedAgents.slice(
      0,
      Math.max(5, Math.floor(popSize * 0.3))
    );
    for (let i = 0; i < crossoverSize; i++) {
      const parent1 = this._selectParent(parentPool, rng);
      const parent2 = this._selectParent(parentPool, rng);
      const child = this._crossover(
        parent1,
        parent2,
        world,
        rng,
        AgentClass,
        GenomeClass
      );
      newPopulation.push(child);
    }

    // 3. Mutações dos melhores
    for (let i = 0; i < mutationSize; i++) {
      const parent = this._selectParent(parentPool, rng);
      const mutant = this._mutateAgent(parent, world, rng, AgentClass);
      newPopulation.push(mutant);
    }

    // 4. Agentes completamente aleatórios (diversidade)
    for (let i = 0; i < randomSize; i++) {
      const randomAgent = this._createRandomAgent(
        world,
        rng,
        AgentClass,
        GenomeClass
      );
      newPopulation.push(randomAgent);
    }

    // Atualiza estado do sistema
    this._updateSystemState(rankedAgents[0].fitness);

    return {
      population: newPopulation,
      champion: rankedAgents[0].genome.clone(),
      bestFitness: rankedAgents[0].fitness,
      bestDelivered: rankedAgents[0].delivered,
    };
  },

  /**
   * Rankeia e avalia população
   */
  _rankAndEvaluate(population: Agent[], world: World): Agent[] {
    // Usa o sistema de recompensas para ranking
    const rankedAgents = RewardSystem.evaluatePopulation(population, world);

    // Calcula diversidade genética
    const diversity = this._calculateDiversity(rankedAgents);
    this.state.diversityHistory.push(diversity);
    if (this.state.diversityHistory.length > 20) {
      this.state.diversityHistory.shift();
    }

    return rankedAgents;
  },

  /**
   * Seleciona pai usando torneio
   */
  _selectParent(parentPool: Agent[], rng: RNG): Agent {
    const tournamentSize = Math.min(3, parentPool.length);
    let best = parentPool[rng.int(parentPool.length)];

    for (let i = 1; i < tournamentSize; i++) {
      const candidate = parentPool[rng.int(parentPool.length)];
      if (candidate.fitness > best.fitness) {
        best = candidate;
      }
    }

    return best;
  },

  /**
   * Cruzamento entre dois pais
   */
  _crossover(
    parent1: Agent,
    parent2: Agent,
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor,
    GenomeClass: GenomeConstructor
  ): Agent {
    if (rng.rand() > this.CONFIG.CROSSOVER_RATE) {
      // Clona o melhor pai
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

    // Cruzamento uniforme nos pesos ocultos
    for (let i = 0; i < genome1.hiddenWeights.length; i++) {
      childGenome.hiddenWeights[i] =
        rng.rand() < 0.5 ? genome1.hiddenWeights[i] : genome2.hiddenWeights[i];
    }

    // Cruzamento nos biases ocultos
    for (let i = 0; i < genome1.hiddenBiases.length; i++) {
      childGenome.hiddenBiases[i] =
        rng.rand() < 0.5 ? genome1.hiddenBiases[i] : genome2.hiddenBiases[i];
    }

    // Cruzamento nos pesos de saída
    for (let i = 0; i < genome1.outputWeights.length; i++) {
      childGenome.outputWeights[i] =
        rng.rand() < 0.5 ? genome1.outputWeights[i] : genome2.outputWeights[i];
    }

    // Cruzamento nos biases de saída
    for (let i = 0; i < genome1.outputBiases.length; i++) {
      childGenome.outputBiases[i] =
        rng.rand() < 0.5 ? genome1.outputBiases[i] : genome2.outputBiases[i];
    }

    // Média nos sensores
    for (let i = 0; i < genome1.sensorAngles.length; i++) {
      childGenome.sensorAngles[i] =
        (genome1.sensorAngles[i] + genome2.sensorAngles[i]) / 2;
    }
    childGenome.sensorRange = (genome1.sensorRange + genome2.sensorRange) / 2;

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

  /**
   * Mutação de um agente
   */
  _mutateAgent(
    parent: Agent,
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor
  ): Agent {
    const mutatedGenome = parent.genome.mutate(rng, this.state.adaptiveSigma);
    return this._createAgentFromGenome(mutatedGenome, world, rng, AgentClass);
  },

  /**
   * Clona um agente
   */
  _cloneAgent(
    parent: Agent,
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor
  ): Agent {
    const clonedGenome = parent.genome.clone();
    return this._createAgentFromGenome(clonedGenome, world, rng, AgentClass);
  },

  /**
   * Cria agente completamente aleatório
   */
  _createRandomAgent(
    world: World,
    rng: RNG,
    AgentClass: AgentConstructor,
    GenomeClass: GenomeConstructor
  ): Agent {
    const randomGenome = new GenomeClass(rng);
    return this._createAgentFromGenome(randomGenome, world, rng, AgentClass);
  },

  /**
   * Cria agente a partir de genoma
   */
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

  /**
   * Calcula diversidade genética da população
   */
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

  /**
   * Calcula distância entre dois genomas
   */
  _genomicDistance(genome1: Genome, genome2: Genome): number {
    let distance = 0;
    const sampleSize = Math.min(50, genome1.hiddenWeights.length);

    for (let i = 0; i < sampleSize; i++) {
      const diff = genome1.hiddenWeights[i] - genome2.hiddenWeights[i];
      distance += diff * diff;
    }

    return Math.sqrt(distance / sampleSize);
  },

  /**
   * Atualiza estado adaptativo do sistema
   */
  _updateSystemState(currentBestFitness: number): void {
    // Detecta estagnação
    if (currentBestFitness <= this.state.lastBestFitness + 0.01) {
      this.state.stagnationCount++;
    } else {
      this.state.stagnationCount = 0;
    }

    this.state.lastBestFitness = currentBestFitness;

    // Ajusta sigma adaptativamente
    if (this.state.stagnationCount > this.CONFIG.STAGNATION_GENERATIONS) {
      // Aumenta mutação se estagnado
      this.state.adaptiveSigma = Math.min(
        this.CONFIG.MUTATION_STRENGTH_MAX,
        this.state.adaptiveSigma * 1.1
      );
    } else {
      // Diminui mutação se progredindo
      this.state.adaptiveSigma = Math.max(
        this.CONFIG.MUTATION_STRENGTH_MIN,
        this.state.adaptiveSigma * 0.99
      );
    }

    // Ajusta baseado na diversidade
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

  /**
   * Obtém estatísticas do sistema genético
   */
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

// Exporta para uso global
if (typeof window !== "undefined") {
  (window as any).GeneticSystem = GeneticSystemImpl;
}
