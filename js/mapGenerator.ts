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
   * Gera obstáculos apenas evitando sobreposição com base
   */
  generateObstacles(w: number, h: number, base: Base, rng: any): Rect[] {
    const oCount = 6 + rng.int(7);
    const obstacles = [];

    for (let i = 0; i < oCount; i++) {
      let ow = 40 + rng.float(0, 120);
      let oh = 30 + rng.float(0, 100);
      let ox,
        oy,
        tries = 0;

      do {
        ox = rng.float(0, w - ow);
        oy = rng.float(0, h - oh);
        tries++;
      } while (
        (this._rectCircleOverlap({ x: ox, y: oy, w: ow, h: oh }, base) ||
          obstacles.some((o) =>
            this._rectOverlap(o, { x: ox, y: oy, w: ow, h: oh })
          )) &&
        tries < 200
      );

      obstacles.push({ x: ox, y: oy, w: ow, h: oh });
    }

    return obstacles;
  },

  /**
   * Gera pedras com nova configuração (30 pedras, até 80 de tamanho)
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
    const sCount = 25 + rng.int(11); // 25-35 pedras (média 30)

    for (let i = 0; i < sCount; i++) {
      const r = 10 + rng.float(0, 6);
      let x,
        y,
        tries = 0;

      do {
        x = rng.float(40, w - 40);
        y = rng.float(40, h - 40);
        tries++;
      } while (
        (this._distance(x, y, base.x, base.y) < 80 ||
          obstacles.some((o) => this._rectCircleOverlap(o, { x, y, r }))) &&
        tries < 200
      );

      // Quantidade de 1 a 80 (média ~40)
      const quantity = 1 + rng.int(80);
      stones.push({ x, y, r, quantity });
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
