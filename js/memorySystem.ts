const MemorySystemImpl = {
  /**
   * Calcula bonus por repetir comportamento bem-sucedido
   */
  calculateMemoryBonus(agent: Agent): number {
    if (!agent.memory || !agent.memory.lastSuccessfulReturnPath) return 0;

    // Se está carregando pedra, dá bonus por seguir caminho similar ao anterior
    if (
      agent.state === "CARRYING" &&
      agent.memory.lastSuccessfulReturnPath.length > 0
    ) {
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
  _calculatePathSimilarity(
    currentPath: Point[],
    successfulPath: Point[]
  ): number {
    if (currentPath.length === 0 || successfulPath.length === 0) return 0;

    const minLength = Math.min(currentPath.length, successfulPath.length);
    let similarity = 0;

    for (let i = 0; i < minLength; i++) {
      const current = currentPath[currentPath.length - 1 - i];
      const successful = successfulPath[successfulPath.length - 1 - i];

      const distance = Math.hypot(
        current.x - successful.x,
        current.y - successful.y
      );
      const maxDistance = 100; // Distância máxima considerada

      similarity += Math.max(0, 1 - distance / maxDistance);
    }

    return similarity / minLength;
  },
};

// Exporta para uso global
if (typeof window !== "undefined") {
  (window as unknown as WindowType).MemorySystem = MemorySystemImpl;
}
