const SensorSystemImpl = {
  calculateSensorData(
    agent: Agent,
    genome: Genome,
    world: World
  ): SensorData[] {
    const sensorData: SensorData[] = [];

    // Usa os sensores configurados no genoma (5 sensores com ângulos evoluídos)
    for (let i = 0; i < genome.sensorAngles.length; i++) {
      const ang = agent.a + genome.sensorAngles[i];
      const data = this._processSensor(agent, ang, genome.sensorRange, world);
      sensorData.push(data);
    }

    // Atualiza memória do agente baseado no melhor sensor
    // Prioriza pedras, depois base
    let bestStone: StoneHit | null = null;
    let bestBase: BaseHit | null = null;

    for (const sensor of sensorData) {
      if (sensor.stoneHit.stone) {
        if (!bestStone || sensor.stoneHit.distance < bestStone.distance) {
          bestStone = sensor.stoneHit;
        }
      }
      if (sensor.baseHit.distance < Infinity) {
        if (!bestBase || sensor.baseHit.distance < bestBase.distance) {
          bestBase = sensor.baseHit;
        }
      }
    }

    if (bestStone) {
      this._updateAgentMemory(
        agent,
        bestStone,
        { distance: Infinity, signal: 0 },
        world
      );
    } else if (bestBase) {
      this._updateAgentMemory(
        agent,
        { distance: Infinity, stone: null, signal: 0 },
        bestBase,
        world
      );
    }

    return sensorData;
  },

  /**
   * Extrai apenas inputs para rede neural
   * 5 sensores × 3 valores = 15 inputs
   * + 2 memória + 3 estado = 20 inputs total
   */
  extractInputs(
    sensorData: SensorData[],
    agent: Agent,
    _world: World
  ): number[] {
    const inputs = new Array(20).fill(0);
    let idx = 0;

    // Dados dos sensores (3 valores por sensor = 15 inputs)
    for (const sensor of sensorData) {
      inputs[idx++] = sensor.proximity;
      inputs[idx++] = sensor.stoneSignal;
      inputs[idx++] = sensor.baseSignal;
    }

    // Memória + estado interno (5 inputs)
    inputs[idx++] =
      agent.lastSeen.angle == null
        ? 0
        : GeometryUtils.clamp(agent.lastSeen.angle / Math.PI, -1, 1);
    inputs[idx++] =
      agent.lastSeen.dist == null
        ? 0
        : GeometryUtils.clamp(1 - agent.lastSeen.dist, 0, 1);
    inputs[idx++] = agent.state === "SEEK" ? 1.0 : 0.0;
    inputs[idx++] = agent.state === "MINING" ? 1.0 : 0.0;
    inputs[idx++] = agent.state === "CARRYING" ? 1.0 : 0.0;

    return inputs;
  },

  /**
   * Desenha sensores usando dados calculados
   */
  drawSensors(
    ctx: CanvasRenderingContext2D,
    agent: Agent,
    sensorData: SensorData[]
  ): void {
    for (const sensor of sensorData) {
      this._drawSensorRay(ctx, agent, sensor);
      this._drawSensorHits(ctx, agent, sensor);
    }
  },

  /**
   * Processa um sensor individual
   */
  _processSensor(
    agent: Agent,
    angle: number,
    range: number,
    world: World
  ): SensorData {
    const dx = Math.cos(angle),
      dy = Math.sin(angle);

    // Detecta obstáculos
    const tObstacle = this._findObstacleDistance(agent, angle, range, world);

    // Detecta pedras
    const stoneHit = this._findStoneHit(agent, dx, dy, range, tObstacle, world);

    // Detecta base
    const baseHit = this._findBaseHit(agent, dx, dy, range, tObstacle, world);

    // Atualiza memória do agente
    this._updateAgentMemory(agent, stoneHit, baseHit, world);

    const tEnd = Math.min(
      tObstacle,
      stoneHit.distance,
      baseHit.distance,
      range
    );

    return {
      angle,
      range,
      obstacleDistance: tObstacle,
      stoneHit,
      baseHit,
      endDistance: tEnd,
      proximity: 1 - GeometryUtils.clamp(tEnd / range, 0, 1),
      stoneSignal: stoneHit.signal,
      baseSignal: baseHit.signal,
    };
  },

  _findObstacleDistance(
    agent: Agent,
    angle: number,
    range: number,
    world: World
  ): number {
    for (let t = 4; t <= range; t += 5) {
      const sx = agent.x + Math.cos(angle) * t;
      const sy = agent.y + Math.sin(angle) * t;

      if (sx < 2 || sy < 2 || sx > world.w - 2 || sy > world.h - 2) return t;

      for (const ob of world.obstacles) {
        if (GeometryUtils.pointInRect(sx, sy, ob)) return t;
      }
    }
    return Infinity;
  },

  _findStoneHit(
    agent: Agent,
    dx: number,
    dy: number,
    range: number,
    tObstacle: number,
    world: World
  ) {
    let bestDistance = Infinity,
      bestStone = null;

    for (const s of world.stones) {
      if (s.quantity > 0) {
        const t = GeometryUtils.rayCircleIntersectT(
          agent.x,
          agent.y,
          dx,
          dy,
          s.x,
          s.y,
          s.r
        );
        if (
          t != null &&
          t >= 0 &&
          t <= range &&
          t < tObstacle &&
          t < bestDistance
        ) {
          bestDistance = t;
          bestStone = s;
        }
      }
    }

    return {
      distance: bestDistance,
      stone: bestStone,
      signal: bestDistance < Infinity ? 1 - bestDistance / range : 0,
    };
  },

  _findBaseHit(
    agent: Agent,
    dx: number,
    dy: number,
    range: number,
    tObstacle: number,
    world: World
  ) {
    const t = GeometryUtils.rayCircleIntersectT(
      agent.x,
      agent.y,
      dx,
      dy,
      world.base.x,
      world.base.y,
      world.base.r
    );
    const distance =
      t != null && t >= 0 && t <= range && t < tObstacle ? t : Infinity;

    return {
      distance,
      signal: distance < Infinity ? 1 - distance / range : 0,
    };
  },

  _updateAgentMemory(
    agent: Agent,
    stoneHit: StoneHit,
    baseHit: BaseHit,
    world: World
  ): void {
    if (stoneHit.stone) {
      agent.lastSeen.angle =
        Math.atan2(stoneHit.stone.y - agent.y, stoneHit.stone.x - agent.x) -
        agent.a;
      agent.lastSeen.dist = GeometryUtils.clamp(
        GeometryUtils.distance(
          agent.x,
          agent.y,
          stoneHit.stone.x,
          stoneHit.stone.y
        ) / Math.hypot(world.w, world.h),
        0,
        1
      );
    } else if (baseHit.distance < Infinity) {
      agent.lastSeen.angle =
        Math.atan2(world.base.y - agent.y, world.base.x - agent.x) - agent.a;
      agent.lastSeen.dist = GeometryUtils.clamp(
        GeometryUtils.distance(agent.x, agent.y, world.base.x, world.base.y) /
          Math.hypot(world.w, world.h),
        0,
        1
      );
    }
  },

  _drawSensorRay(
    ctx: CanvasRenderingContext2D,
    agent: Agent,
    sensor: SensorData
  ): void {
    const endX = agent.x + Math.cos(sensor.angle) * sensor.endDistance;
    const endY = agent.y + Math.sin(sensor.angle) * sensor.endDistance;

    ctx.beginPath();
    ctx.moveTo(agent.x, agent.y);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle =
      sensor.stoneHit.distance <= sensor.endDistance
        ? "#ffd89b"
        : sensor.baseHit.distance <= sensor.endDistance
          ? "#bdf7c7"
          : "rgba(200,220,255,0.06)";
    ctx.lineWidth = 1;
    ctx.stroke();
  },

  _drawSensorHits(
    ctx: CanvasRenderingContext2D,
    agent: Agent,
    sensor: SensorData
  ): void {
    if (sensor.stoneHit.distance <= sensor.endDistance) {
      const x = agent.x + Math.cos(sensor.angle) * sensor.stoneHit.distance;
      const y = agent.y + Math.sin(sensor.angle) * sensor.stoneHit.distance;
      ctx.beginPath();
      ctx.fillStyle = "#ffb86b";
      ctx.arc(x, y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    if (sensor.baseHit.distance <= sensor.endDistance) {
      const x = agent.x + Math.cos(sensor.angle) * sensor.baseHit.distance;
      const y = agent.y + Math.sin(sensor.angle) * sensor.baseHit.distance;
      ctx.beginPath();
      ctx.fillStyle = "#8effb5";
      ctx.arc(x, y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

if (typeof window !== "undefined") {
  (window as unknown as WindowType).SensorSystem = SensorSystemImpl;
}
