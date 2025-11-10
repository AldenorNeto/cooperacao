// Sistema genético simplificado e mais agressivo
const SimpleGeneticSystem = {
  
  state: {
    generation: 0,
    bestFitness: 0,
    stagnationCount: 0,
    adaptiveSigma: 0.25
  },
  
  evolvePopulation(population: any[], world: any, rng: any, AgentClass: any, GenomeClass: any): any {
    // Ordenar por fitness
    population.sort((a, b) => b.fitness - a.fitness);
    
    const popSize = population.length;
    const eliteSize = Math.max(3, Math.floor(popSize * 0.1)); // Apenas 10% elite
    const newPopulation: any[] = [];
    
    // 1. Preservar elite
    for (let i = 0; i < eliteSize; i++) {
      const clone = this.cloneAgent(population[i], world, rng, AgentClass);
      newPopulation.push(clone);
    }
    
    // 2. Resto é mutação agressiva dos melhores
    const parentPool = population.slice(0, Math.max(5, Math.floor(popSize * 0.3)));
    
    while (newPopulation.length < popSize) {
      const parent = parentPool[rng.int(parentPool.length)];
      const mutant = this.mutateAgent(parent, world, rng, AgentClass, 0.3); // Mutação forte
      newPopulation.push(mutant);
    }
    
    this.state.generation++;
    
    return {
      population: newPopulation,
      champion: population[0].genome.clone(),
      bestFitness: population[0].fitness,
      bestDelivered: population[0].delivered
    };
  },
  
  cloneAgent(parent: any, world: any, rng: any, AgentClass: any): any {
    const clonedGenome = parent.genome.clone();
    return new AgentClass(
      world.base.x + world.base.r + 6 + rng.float(-6, 6),
      world.base.y + rng.float(-6, 6),
      rng.float(0, Math.PI * 2),
      clonedGenome
    );
  },
  
  mutateAgent(parent: any, world: any, rng: any, AgentClass: any, sigma: number): any {
    const mutatedGenome = parent.genome.mutate(rng, sigma);
    return new AgentClass(
      world.base.x + world.base.r + 6 + rng.float(-6, 6),
      world.base.y + rng.float(-6, 6),
      rng.float(0, Math.PI * 2),
      mutatedGenome
    );
  },
  
  getStats() {
    return {
      generation: this.state.generation,
      adaptiveSigma: this.state.adaptiveSigma.toFixed(3),
      diversity: "N/A",
      isStagnant: false,
      stagnationCount: 0
    };
  }
};

// Substituir sistema complexo
if (typeof window !== "undefined") {
  (window as any).GeneticSystem = SimpleGeneticSystem;
}