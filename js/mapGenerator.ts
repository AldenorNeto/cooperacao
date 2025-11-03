const MapGeneratorImpl = {
  /**
   * Gera base em posição aleatória
   */
  generateBase(w: number, h: number, rng: any): Base {
    return {
      x: w * 0.12 + w * 0.76 * rng.rand(),
      y: h * 0.12 + h * 0.76 * rng.rand(),
      r: 18, // CONFIG.AGENT.BASE_RADIUS
    };
  },

  /**
   * Gera obstáculos usando grid + jitter
   */
  generateObstacles(w: number, h: number, base: Base, rng: any): Rect[] {
    const oCount = 6 + rng.int(7);
    const obstacles = [];
    const gridCols = Math.ceil(Math.sqrt(oCount * 2));
    const gridRows = Math.ceil(oCount / gridCols);
    const cellW = w / gridCols;
    const cellH = h / gridRows;

    for (let i = 0; i < oCount; i++) {
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);
      
      const ow = 40 + rng.float(0, 120);
      const oh = 30 + rng.float(0, 100);
      
      // Grid position + jitter
      const ox = col * cellW + rng.float(0, cellW - ow);
      const oy = row * cellH + rng.float(0, cellH - oh);
      
      // Skip if overlaps base
      if (!this._rectCircleOverlap({ x: ox, y: oy, w: ow, h: oh }, base)) {
        obstacles.push({ x: ox, y: oy, w: ow, h: oh });
      }
    }

    return obstacles;
  },

  /**
   * Gera pedras usando grid + jitter
   */
  generateStones(
    w: number,
    h: number,
    base: Base,
    obstacles: Rect[],
    minTotalQuantity: number,
    rng: any
  ): Stone[] {
    const stones = [];
    const sCount = 25 + rng.int(11);
    const gridCols = Math.ceil(Math.sqrt(sCount));
    const gridRows = Math.ceil(sCount / gridCols);
    const cellW = w / gridCols;
    const cellH = h / gridRows;

    for (let i = 0; i < sCount; i++) {
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);
      const r = 10 + rng.float(0, 6);
      
      // Grid position + jitter
      const x = col * cellW + cellW/2 + rng.float(-cellW*0.3, cellW*0.3);
      const y = row * cellH + cellH/2 + rng.float(-cellH*0.3, cellH*0.3);
      
      // Skip if too close to base or overlaps obstacles
      if (this._distance(x, y, base.x, base.y) >= 80 && 
          !obstacles.some((o) => this._rectCircleOverlap(o, { x, y, r }))) {
        const quantity = 1 + rng.int(80);
        stones.push({ x: this._clamp(x, 40, w-40), y: this._clamp(y, 40, h-40), r, quantity });
      }
    }

    // Ajusta quantidades para garantir mínimo
    this._adjustStoneQuantities(stones, minTotalQuantity, w, h, rng);

    return stones;
  },

  /**
   * Ajusta quantidades das pedras
   */
  _adjustStoneQuantities(
    stones: Stone[],
    minTotalQuantity: number,
    w: number,
    h: number,
    rng: any
  ): void {
    let total = stones.reduce((s, stone) => s + stone.quantity, 0);
    let idx = 0;

    while (total < minTotalQuantity) {
      stones[idx % stones.length].quantity += 1;
      total++;
      idx++;
    }

    // Adiciona variação de posição
    for (const s of stones) {
      s.x += rng.float(-8, 8);
      s.y += rng.float(-8, 8);
      s.x = this._clamp(s.x, 30, w - 30);
      s.y = this._clamp(s.y, 30, h - 30);
    }
  },

  // Usa utilitários geométricos centralizados
  _distance: GeometryUtils.distance,
  _distanceToBase(x: number, y: number, base: Base): number {
    return this._distance(x, y, base.x, base.y);
  },
  _clamp: GeometryUtils.clamp,
  _rectOverlap(a: Rect, b: Rect): boolean {
    return !(
      a.x + a.w < b.x ||
      b.x + b.w < a.x ||
      a.y + a.h < b.y ||
      b.y + b.h < a.y
    );
  },
  _rectCircleOverlap: GeometryUtils.rectCircleOverlap,
};

// Exporta para uso global
if (typeof window !== "undefined") {
  (window as any).MapGenerator = MapGeneratorImpl;
}
