const MemorySystemImpl = {
  /**
   * Adiciona memória de comportamento bem-sucedido
   */
  recordSuccessfulBehavior(agent: Agent, world: World): void {
    if (!agent.memory) {
      agent.memory = { angle: 0, dist: 0 };
    }
    
    // Registra posição quando pega pedra
    if (agent.carry && !agent.memory.lastPickupPosition) {
      agent.memory.lastPickupPosition = { x: agent.x, y: agent.y };
    }
    
    // Registra caminho de retorno bem-sucedido
    if (agent.delivered > (agent.memory.lastDeliveryCount || 0)) {
      agent.memory.lastDeliveryCount = agent.delivered;
      agent.memory.lastSuccessfulReturnPath = [...agent.trail];
      agent.memory.lastPickupPosition = undefined;
    }
  },

  /**
   * Calcula bonus por repetir comportamento bem-sucedido
   */
  calculateMemoryBonus(agent: Agent, world: World): number {
    if (!agent.memory || !agent.memory.lastSuccessfulReturnPath) return 0;
    
    // Se está carregando pedra, dá bonus por seguir caminho similar ao anterior
    if (agent.carry && agent.memory.lastSuccessfulReturnPath.length > 0) {
      const pathSimilarity = this._calculatePathSimilarity(
        agent.trail,
        agent.memory.lastSuccessfulReturnPath
      );
      return pathSimilarity * 50; // Bonus por seguir padrão bem-sucedido
    }
    
    return 0;
  },

  /**
   * Calcula similaridade entre caminhos
   */
  _calculatePathSimilarity(currentPath: Point[], successfulPath: Point[]): number {
    if (currentPath.length === 0 || successfulPath.length === 0) return 0;
    
    const minLength = Math.min(currentPath.length, successfulPath.length);
    let similarity = 0;
    
    for (let i = 0; i < minLength; i++) {
      const current = currentPath[currentPath.length - 1 - i];
      const successful = successfulPath[successfulPath.length - 1 - i];
      
      const distance = Math.hypot(current.x - successful.x, current.y - successful.y);
      const maxDistance = 100; // Distância máxima considerada
      
      similarity += Math.max(0, 1 - (distance / maxDistance));
    }
    
    return similarity / minLength;
  }
};

// Exporta para uso global
if (typeof window !== "undefined") {
  (window as any).MemorySystem = MemorySystemImpl;
}