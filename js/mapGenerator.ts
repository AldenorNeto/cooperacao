const MapGeneratorImpl = {
  /**
   * Gera base em posição aleatória
   */
  generateBase(w: number, h: number, rng: RNG): Base {
    return {
      x: w * 0.12 + w * 0.76 * rng.rand(),
      y: h * 0.12 + h * 0.76 * rng.rand(),
      r: 18, // CONFIG.AGENT.BASE_RADIUS
    };
  },

  /**
   * Gera obstáculos com melhor distribuição e tamanhos variados
   */
  generateObstacles(w: number, h: number, base: Base, rng: RNG): Rect[] {
    const obstacles: Rect[] = [];
    const oCount = 8 + rng.int(6); // 8-13 obstáculos

    // Define zonas de exclusão ao redor da base
    const baseExclusionRadius = base.r * 4;

    // Cria clusters de obstáculos para layout mais interessante
    const clusterCount = 3 + rng.int(3); // 3-5 clusters
    const clusters: Array<{ x: number; y: number }> = [];

    for (let c = 0; c < clusterCount; c++) {
      let cx: number, cy: number;
      let attempts = 0;

      // Encontra posição válida para cluster
      do {
        cx = 100 + rng.float(0, w - 200);
        cy = 100 + rng.float(0, h - 200);
        attempts++;
      } while (
        this._distance(cx, cy, base.x, base.y) < baseExclusionRadius * 2 &&
        attempts < 20
      );

      clusters.push({ x: cx, y: cy });
    }

    // Distribui obstáculos entre clusters
    const obstaclesPerCluster = Math.floor(oCount / clusterCount);
    const remainder = oCount % clusterCount;

    for (let c = 0; c < clusterCount; c++) {
      const cluster = clusters[c];
      const count = obstaclesPerCluster + (c < remainder ? 1 : 0);

      for (let i = 0; i < count; i++) {
        // Tamanhos variados: pequenos, médios e grandes
        const sizeType = rng.float(0, 1);
        let ow: number, oh: number;

        if (sizeType < 0.3) {
          // Pequenos (30%)
          ow = 30 + rng.float(0, 40);
          oh = 30 + rng.float(0, 40);
        } else if (sizeType < 0.7) {
          // Médios (40%)
          ow = 50 + rng.float(0, 60);
          oh = 50 + rng.float(0, 60);
        } else {
          // Grandes (30%)
          ow = 80 + rng.float(0, 80);
          oh = 80 + rng.float(0, 80);
        }

        // Alguns obstáculos mais retangulares
        if (rng.float(0, 1) < 0.4) {
          if (rng.float(0, 1) < 0.5) {
            ow *= 1.5; // Horizontal
          } else {
            oh *= 1.5; // Vertical
          }
        }

        // Posição dentro do cluster com dispersão
        const spreadRadius = 120;
        const angle = rng.float(0, Math.PI * 2);
        const distance = rng.float(0, spreadRadius);

        const ox = cluster.x + Math.cos(angle) * distance;
        const oy = cluster.y + Math.sin(angle) * distance;

        // Garante que está dentro dos limites
        const clampedX = this._clamp(ox, 20, w - ow - 20);
        const clampedY = this._clamp(oy, 20, h - oh - 20);

        const newObstacle = { x: clampedX, y: clampedY, w: ow, h: oh };

        // Verifica colisões
        const tooCloseToBase =
          this._distance(clampedX + ow / 2, clampedY + oh / 2, base.x, base.y) <
          baseExclusionRadius;

        const overlapsOther = obstacles.some((o) =>
          this._rectOverlapWithMargin(newObstacle, o, 10)
        );

        if (!tooCloseToBase && !overlapsOther) {
          obstacles.push(newObstacle);
        }
      }
    }

    // Adiciona alguns obstáculos isolados para variedade
    const isolatedCount = 2 + rng.int(3);
    for (let i = 0; i < isolatedCount; i++) {
      const ow = 40 + rng.float(0, 60);
      const oh = 40 + rng.float(0, 60);

      let ox: number = 0,
        oy: number = 0;
      let attempts = 0;

      do {
        ox = 50 + rng.float(0, w - ow - 100);
        oy = 50 + rng.float(0, h - oh - 100);
        attempts++;
      } while (
        attempts < 30 &&
        (this._distance(ox + ow / 2, oy + oh / 2, base.x, base.y) <
          baseExclusionRadius ||
          obstacles.some((o) =>
            this._rectOverlapWithMargin({ x: ox, y: oy, w: ow, h: oh }, o, 15)
          ))
      );

      if (attempts < 30) {
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
    rng: RNG
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
      const r = 12; // Tamanho fixo para todas as pedras

      // Grid position + jitter
      const x = col * cellW + cellW / 2 + rng.float(-cellW * 0.3, cellW * 0.3);
      const y = row * cellH + cellH / 2 + rng.float(-cellH * 0.3, cellH * 0.3);

      // Skip if too close to base or overlaps obstacles
      const minDistFromBase = Math.max(240, base.r * 16); // Mínimo 120px ou 8x raio da base
      if (
        this._distance(x, y, base.x, base.y) >= minDistFromBase &&
        !obstacles.some((o) => this._rectCircleOverlap(o, { x, y, r }))
      ) {
        const quantity = 12 + rng.int(80);
        const clampedX = this._clamp(x, 40, w - 40);
        const clampedY = this._clamp(y, 40, h - 40);

        // Verifica distância após clamp
        if (
          this._distance(clampedX, clampedY, base.x, base.y) >= minDistFromBase
        ) {
          stones.push({
            x: clampedX,
            y: clampedY,
            r,
            quantity,
            initialQuantity: quantity,
          });
        }
      }
    }

    // Ajusta quantidades para garantir mínimo
    this._adjustStoneQuantities(stones, minTotalQuantity, w, h, base, rng);

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
    base: Base,
    rng: RNG
  ): void {
    let total = stones.reduce((s, stone) => s + stone.quantity, 0);
    let idx = 0;

    while (total < minTotalQuantity) {
      stones[idx % stones.length].quantity += 1;
      total++;
      idx++;
    }

    // Adiciona variação de posição (com verificação de distância)
    const minDistFromBase = Math.max(120, base.r * 8);
    for (const s of stones) {
      let attempts = 0;
      let newX, newY;

      do {
        newX = s.x + rng.float(-8, 8);
        newY = s.y + rng.float(-8, 8);
        newX = this._clamp(newX, 30, w - 30);
        newY = this._clamp(newY, 30, h - 30);
        attempts++;
      } while (
        this._distance(newX, newY, base.x, base.y) < minDistFromBase &&
        attempts < 10
      );

      // Só aplica se encontrou posição válida
      if (this._distance(newX, newY, base.x, base.y) >= minDistFromBase) {
        s.x = newX;
        s.y = newY;
      }
    }
  },

  /**
   * Cria uma nova pedra em posição válida quando uma é totalmente minerada
   */
  respawnStone(
    w: number,
    h: number,
    base: Base,
    obstacles: Rect[],
    existingStones: Stone[],
    initialQuantity: number,
    rng: RNG
  ): Stone | null {
    const r = 12; // Tamanho padrão das pedras
    const minDistFromBase = Math.max(240, base.r * 16);
    const minDistBetweenStones = 40; // Distância mínima entre pedras
    const maxAttempts = 50;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Posição aleatória
      const x = 40 + rng.float(0, w - 80);
      const y = 40 + rng.float(0, h - 80);

      // Verifica distância da base
      if (this._distance(x, y, base.x, base.y) < minDistFromBase) {
        continue;
      }

      // Verifica colisão com obstáculos
      const collidesObstacle = obstacles.some((o) =>
        this._rectCircleOverlap(o, { x, y, r })
      );
      if (collidesObstacle) continue;

      // Verifica distância de outras pedras
      const tooCloseToStone = existingStones.some((s) => {
        if (s.quantity <= 0) return false; // Ignora pedras vazias
        return this._distance(x, y, s.x, s.y) < minDistBetweenStones;
      });
      if (tooCloseToStone) continue;

      // Posição válida encontrada!
      return {
        x,
        y,
        r,
        quantity: initialQuantity,
        initialQuantity: initialQuantity,
      };
    }

    // Não conseguiu encontrar posição válida
    return null;
  },

  // Usa utilitários geométricos centralizados
  _distance: GeometryUtils.distance,
  _distanceToBase(x: number, y: number, base: Base): number {
    return this._distance(x, y, base.x, base.y);
  },

  /**
   * Cria zonas de exclusão ao redor da base
   */
  _isInExclusionZone(x: number, y: number, base: Base): boolean {
    const minDist = Math.max(120, base.r * 8);
    return this._distance(x, y, base.x, base.y) < minDist;
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
  _rectOverlapWithMargin(a: Rect, b: Rect, margin: number): boolean {
    return !(
      a.x + a.w + margin < b.x ||
      b.x + b.w + margin < a.x ||
      a.y + a.h + margin < b.y ||
      b.y + b.h + margin < a.y
    );
  },
  _rectCircleOverlap: GeometryUtils.rectCircleOverlap,
};

// Exporta para uso global
if (typeof window !== "undefined") {
  (window as unknown as WindowType).MapGenerator = MapGeneratorImpl;
}
