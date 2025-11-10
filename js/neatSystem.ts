// Sistema NEAT - NeuroEvolution of Augmenting Topologies
interface NEATConfig {
  inputs: number;
  outputs: number;
  populationSize: number;
  addNodeRate: number;
  addConnectionRate: number;
  mutateWeightRate: number;
  weightMutationPower: number;
  compatibilityThreshold: number;
  elitism: number;
  survivalThreshold: number;
}

interface NEATNode {
  id: number;
  type: 'input' | 'hidden' | 'output';
  value: number;
  bias: number;
}

interface NEATConnection {
  from: number;
  to: number;
  weight: number;
  enabled: boolean;
  innovation: number;
}

interface NEATNetwork {
  nodes: Map<number, NEATNode>;
  connections: NEATConnection[];
  fitness: number;
  species: number;
  
  activate(inputs: number[]): number[];
  clone(): NEATNetwork;
  mutate(config: NEATConfig): void;
  crossover(other: NEATNetwork, config: NEATConfig): NEATNetwork;
  distance(other: NEATNetwork, config: NEATConfig): number;
}

class SimpleNEATNetwork implements NEATNetwork {
  nodes = new Map<number, NEATNode>();
  connections: NEATConnection[] = [];
  fitness = 0;
  species = 0;
  
  private static nextNodeId = 0;
  private static nextInnovation = 0;

  constructor(inputs: number, outputs: number) {
    // Criar nós de entrada
    for (let i = 0; i < inputs; i++) {
      this.nodes.set(i, {
        id: i,
        type: 'input',
        value: 0,
        bias: 0
      });
    }
    
    // Criar nós de saída
    for (let i = 0; i < outputs; i++) {
      const id = inputs + i;
      this.nodes.set(id, {
        id,
        type: 'output',
        value: 0,
        bias: Math.random() * 2 - 1
      });
    }
    
    SimpleNEATNetwork.nextNodeId = inputs + outputs;
    
    // Conectar todas as entradas às saídas
    for (let i = 0; i < inputs; i++) {
      for (let j = 0; j < outputs; j++) {
        this.connections.push({
          from: i,
          to: inputs + j,
          weight: Math.random() * 4 - 2,
          enabled: true,
          innovation: SimpleNEATNetwork.nextInnovation++
        });
      }
    }
  }

  activate(inputs: number[]): number[] {
    // Reset valores dos nós não-input
    this.nodes.forEach(node => {
      if (node.type !== 'input') node.value = 0;
    });
    
    // Definir entradas
    for (let i = 0; i < Math.min(inputs.length, this.nodes.size); i++) {
      const node = this.nodes.get(i);
      if (node && node.type === 'input') {
        node.value = inputs[i] || 0;
      }
    }
    
    // Propagar através das conexões
    for (const conn of this.connections) {
      if (!conn.enabled) continue;
      
      const fromNode = this.nodes.get(conn.from);
      const toNode = this.nodes.get(conn.to);
      
      if (fromNode && toNode && toNode.type !== 'input') {
        toNode.value += fromNode.value * conn.weight;
      }
    }
    
    // Aplicar função de ativação aos nós hidden e output
    this.nodes.forEach(node => {
      if (node.type === 'hidden' || node.type === 'output') {
        node.value = 1 / (1 + Math.exp(-(node.value + node.bias)));
      }
    });
    
    // Coletar saídas na ordem correta
    const outputs: number[] = [];
    const inputCount = Array.from(this.nodes.values()).filter(n => n.type === 'input').length;
    
    for (let i = 0; i < 4; i++) {
      const outputNode = this.nodes.get(inputCount + i);
      outputs.push(outputNode ? outputNode.value : 0);
    }
    
    return outputs;
  }

  clone(): NEATNetwork {
    const clone = Object.create(SimpleNEATNetwork.prototype);
    clone.nodes = new Map();
    clone.connections = [];
    clone.fitness = this.fitness;
    clone.species = this.species;
    
    this.nodes.forEach((node, id) => {
      clone.nodes.set(id, { ...node });
    });
    
    clone.connections = this.connections.map(conn => ({ ...conn }));
    
    return clone;
  }

  mutate(config: NEATConfig): void {
    // Mutar pesos
    for (const conn of this.connections) {
      if (Math.random() < config.mutateWeightRate) {
        if (Math.random() < 0.9) {
          conn.weight += (Math.random() * 2 - 1) * config.weightMutationPower;
        } else {
          conn.weight = Math.random() * 4 - 2;
        }
      }
    }
    
    // Adicionar nó
    if (Math.random() < config.addNodeRate && this.connections.length > 0) {
      const connIndex = Math.floor(Math.random() * this.connections.length);
      const oldConn = this.connections[connIndex];
      
      if (oldConn.enabled) {
        oldConn.enabled = false;
        
        const newNodeId = SimpleNEATNetwork.nextNodeId++;
        this.nodes.set(newNodeId, {
          id: newNodeId,
          type: 'hidden',
          value: 0,
          bias: 0
        });
        
        this.connections.push({
          from: oldConn.from,
          to: newNodeId,
          weight: 1.0,
          enabled: true,
          innovation: SimpleNEATNetwork.nextInnovation++
        });
        
        this.connections.push({
          from: newNodeId,
          to: oldConn.to,
          weight: oldConn.weight,
          enabled: true,
          innovation: SimpleNEATNetwork.nextInnovation++
        });
      }
    }
    
    // Adicionar conexão
    if (Math.random() < config.addConnectionRate) {
      const nodeIds = Array.from(this.nodes.keys());
      const from = nodeIds[Math.floor(Math.random() * nodeIds.length)];
      const to = nodeIds[Math.floor(Math.random() * nodeIds.length)];
      
      const fromNode = this.nodes.get(from);
      const toNode = this.nodes.get(to);
      
      if (fromNode && toNode && 
          fromNode.type !== 'output' && 
          toNode.type !== 'input' &&
          from !== to) {
        
        const exists = this.connections.some(c => c.from === from && c.to === to);
        
        if (!exists) {
          this.connections.push({
            from,
            to,
            weight: Math.random() * 4 - 2,
            enabled: true,
            innovation: SimpleNEATNetwork.nextInnovation++
          });
        }
      }
    }
  }

  crossover(other: NEATNetwork, config: NEATConfig): NEATNetwork {
    const child = new SimpleNEATNetwork(0, 0);
    child.nodes.clear();
    child.connections = [];
    
    const allNodeIds = new Set([...this.nodes.keys(), ...other.nodes.keys()]);
    allNodeIds.forEach(id => {
      const node1 = this.nodes.get(id);
      const node2 = other.nodes.get(id);
      
      if (node1 && node2) {
        child.nodes.set(id, Math.random() < 0.5 ? { ...node1 } : { ...node2 });
      } else if (node1) {
        child.nodes.set(id, { ...node1 });
      } else if (node2) {
        child.nodes.set(id, { ...node2 });
      }
    });
    
    const innovations1 = new Map(this.connections.map(c => [c.innovation, c]));
    const innovations2 = new Map(other.connections.map(c => [c.innovation, c]));
    const allInnovations = new Set([...innovations1.keys(), ...innovations2.keys()]);
    
    allInnovations.forEach(innovation => {
      const conn1 = innovations1.get(innovation);
      const conn2 = innovations2.get(innovation);
      
      if (conn1 && conn2) {
        const chosen = this.fitness >= other.fitness ? conn1 : conn2;
        child.connections.push({ ...chosen });
      } else if (conn1 && this.fitness >= other.fitness) {
        child.connections.push({ ...conn1 });
      } else if (conn2 && other.fitness > this.fitness) {
        child.connections.push({ ...conn2 });
      }
    });
    
    return child;
  }

  distance(other: NEATNetwork, config: NEATConfig): number {
    const innovations1 = new Set(this.connections.map(c => c.innovation));
    const innovations2 = new Set(other.connections.map(c => c.innovation));
    
    const matching = new Set([...innovations1].filter(i => innovations2.has(i)));
    const disjoint = (innovations1.size + innovations2.size - 2 * matching.size);
    
    let weightDiff = 0;
    if (matching.size > 0) {
      const conn1Map = new Map(this.connections.map(c => [c.innovation, c]));
      const conn2Map = new Map(other.connections.map(c => [c.innovation, c]));
      
      matching.forEach(innovation => {
        const c1 = conn1Map.get(innovation);
        const c2 = conn2Map.get(innovation);
        if (c1 && c2) {
          weightDiff += Math.abs(c1.weight - c2.weight);
        }
      });
      weightDiff /= matching.size;
    }
    
    const maxConnections = Math.max(this.connections.length, other.connections.length);
    const normalizer = maxConnections < 20 ? 1 : maxConnections;
    
    return (disjoint / normalizer) + weightDiff;
  }
}

const NEATSystemImpl = {
  config: {
    inputs: 21,
    outputs: 4,
    populationSize: 50,
    addNodeRate: 0.1,
    addConnectionRate: 0.3,
    mutateWeightRate: 0.9,
    weightMutationPower: 1.5,
    compatibilityThreshold: 4.0,
    elitism: 0.1,
    survivalThreshold: 0.3
  } as NEATConfig,

  population: [] as NEATNetwork[],
  generation: 0,

  initializePopulation(): void {
    this.population = [];
    for (let i = 0; i < this.config.populationSize; i++) {
      this.population.push(new SimpleNEATNetwork(this.config.inputs, this.config.outputs));
    }
  },

  evolvePopulation(agents: any[]): any[] {
    // Atualizar fitness
    agents.forEach((agent, i) => {
      if (i < this.population.length) {
        this.population[i].fitness = agent.fitness;
      }
    });

    // Ordenar por fitness
    this.population.sort((a, b) => b.fitness - a.fitness);
    
    const newPopulation: NEATNetwork[] = [];
    const eliteCount = Math.floor(this.config.populationSize * this.config.elitism);
    
    // Elitismo
    for (let i = 0; i < eliteCount; i++) {
      newPopulation.push(this.population[i].clone());
    }
    
    // Reprodução
    while (newPopulation.length < this.config.populationSize) {
      if (Math.random() < 0.7) {
        // Cruzamento
        const parent1 = this.selectParent();
        const parent2 = this.selectParent();
        const child = parent1.crossover(parent2, this.config);
        child.mutate(this.config);
        newPopulation.push(child);
      } else {
        // Mutação
        const parent = this.selectParent();
        const child = parent.clone();
        child.mutate(this.config);
        newPopulation.push(child);
      }
    }
    
    this.population = newPopulation;
    this.generation++;
    
    return this.createAgentsFromNetworks(this.population, agents[0]);
  },

  selectParent(): NEATNetwork {
    const tournamentSize = 3;
    let best = this.population[Math.floor(Math.random() * this.population.length)];
    
    for (let i = 1; i < tournamentSize; i++) {
      const candidate = this.population[Math.floor(Math.random() * this.population.length)];
      if (candidate.fitness > best.fitness) {
        best = candidate;
      }
    }
    
    return best;
  },

  createAgentsFromNetworks(networks: NEATNetwork[], sampleAgent: any): any[] {
    return networks.map((network) => {
      const baseX = sampleAgent?.world?.base?.x || 400;
      const baseY = sampleAgent?.world?.base?.y || 300;
      const baseR = sampleAgent?.world?.base?.r || 30;
      
      const agent = {
        x: baseX + baseR + 6 + (Math.random() - 0.5) * 12,
        y: baseY + (Math.random() - 0.5) * 12,
        a: Math.random() * Math.PI * 2,
        v: 0,
        state: "SEEK",
        carry: false,
        mineTimer: 0,
        depositTimer: 0,
        memory: { angle: 0, dist: 0 },
        delivered: 0,
        deliveries: 0,
        hasMinedBefore: false,
        collisions: 0,
        age: 0,
        trail: [],
        fitness: 0,
        genome: new NEATGenomeWrapper(network),
        id: Math.floor(Math.random() * 1e9),
        hasLeftBase: false,
        lastSeen: { angle: null, dist: null },
        record: function() {
          this.trail.push({ x: this.x, y: this.y });
          if (this.trail.length > 60) this.trail.shift();
        }
      };
      
      return agent;
    });
  },

  getBestNetwork(): NEATNetwork | null {
    if (this.population.length === 0) return null;
    return this.population.reduce((best, current) => 
      current.fitness > best.fitness ? current : best
    );
  },

  getStats() {
    const avgFitness = this.population.reduce((sum, net) => sum + net.fitness, 0) / this.population.length;
    const bestFitness = Math.max(...this.population.map(net => net.fitness));
    const avgConnections = this.population.reduce((sum, net) => sum + net.connections.length, 0) / this.population.length;
    const avgNodes = this.population.reduce((sum, net) => sum + net.nodes.size, 0) / this.population.length;
    
    return {
      generation: this.generation,
      species: 1,
      avgFitness: avgFitness.toFixed(2),
      bestFitness: bestFitness.toFixed(2),
      avgConnections: avgConnections.toFixed(1),
      avgNodes: avgNodes.toFixed(1)
    };
  }
};

// Wrapper para compatibilidade
class NEATGenomeWrapper {
  sensorAngles = new Float32Array([-0.5, 0, 0.5]);
  sensorRange = 150;
  inputs = 21;
  hidden = 0;
  outputs = 4;
  
  hiddenWeights = new Float32Array(0);
  hiddenBiases = new Float32Array(0);
  outputWeights = new Float32Array(0);
  outputBiases = new Float32Array(0);

  constructor(public network: NEATNetwork) {}

  feed(inputs: number[]): number[] {
    return this.network.activate(inputs);
  }

  clone(): NEATGenomeWrapper {
    return new NEATGenomeWrapper(this.network.clone());
  }

  mutate(rng: any, sigma: number): NEATGenomeWrapper {
    const mutated = this.network.clone();
    mutated.mutate(NEATSystemImpl.config);
    return new NEATGenomeWrapper(mutated);
  }

  serialize(): string {
    return JSON.stringify({
      nodes: Array.from(this.network.nodes.entries()),
      connections: this.network.connections,
      fitness: this.network.fitness
    });
  }

  static deserialize(data: string): NEATGenomeWrapper {
    const parsed = JSON.parse(data);
    const network = new SimpleNEATNetwork(0, 0);
    network.nodes = new Map(parsed.nodes);
    network.connections = parsed.connections;
    network.fitness = parsed.fitness;
    return new NEATGenomeWrapper(network);
  }
}

// Exportar para uso global
if (typeof window !== "undefined") {
  (window as any).NEATSystem = NEATSystemImpl;
  (window as any).NEATGenomeWrapper = NEATGenomeWrapper;
  (window as any).SimpleNEATNetwork = SimpleNEATNetwork;
}