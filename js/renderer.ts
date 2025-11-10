const RendererImpl = {
  draw(world: World, population: Agent[], sim: Simulation): void {
    const ctx = sim.ctx;
    ctx.clearRect(0, 0, sim.canvas.width, sim.canvas.height);

    this.drawEnvironment(ctx, world);
    this.drawAgents(ctx, population);
    this.drawUI(ctx, sim);
  },

  drawEnvironment(ctx: CanvasRenderingContext2D, world: World): void {
    // Obstáculos
    ctx.fillStyle = "#2b2f37";
    for (const ob of world.obstacles) {
      ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
    }

    // Pedras
    for (const s of world.stones) {
      ctx.beginPath();
      ctx.fillStyle = s.quantity > 0 ? "#a9a089" : "#444";
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#111";
      ctx.stroke();
      ctx.fillStyle = "#dff";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.quantity.toString(), s.x, s.y);
    }

    // Base vermelha com contador
    ctx.beginPath();
    ctx.fillStyle = "#8B0000";
    ctx.strokeStyle = "#FF0000";
    ctx.arc(world.base.x, world.base.y, world.base.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Contador de pedras na base
    ctx.fillStyle = "#FFF";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(world.stonesDelivered.toString(), world.base.x, world.base.y);
  },

  drawAgents(
    ctx: CanvasRenderingContext2D,
    population: Agent[],
  ): void {
    // Agentes
    for (const a of population) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.a);

      let col = a.carry ? "#2fd28f" : "#58a6ff";
      if (a.state === "MINING") col = "#ff9a4d";
      if (a.state === "DEPOSIT") col = "#ffd56b";

      ctx.beginPath();
      ctx.fillStyle = col;
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(5, 0);
      ctx.lineTo(9, 0);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // Destaca campeão
    if (population[0]) {
      ctx.beginPath();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.arc(population[0].x, population[0].y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  drawUI(ctx: CanvasRenderingContext2D, sim: Simulation): void {
    ctx.save();
    ctx.fillStyle = "rgba(2,6,10,0.35)";
    ctx.fillRect(8, 8, 340, 114);
    ctx.fillStyle = "#cfe7ff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Gen: ${sim.generation}`, 14, 26);
    ctx.fillText(`Best fit: ${sim.bestFitness}`, 14, 44);
    ctx.fillText(`Delivered: ${sim.bestDelivered}`, 14, 62);
    ctx.fillText(`Steps: ${sim.genStepCount}/${sim.stepsPerGen}`, 14, 80);
    ctx.fillText(`Pop: ${sim.population.length}`, 200, 80);
    ctx.fillText(`Total Stones: ${sim.world?.stonesDelivered ?? 0}`, 14, 98);
    ctx.restore();
  },

  drawSensors(
    ctx: CanvasRenderingContext2D,
    agent: Agent,
  ): void {
    if (agent.sensorData) {
      SensorSystem.drawSensors(ctx, agent, agent.sensorData);
    }
  },

  drawRedText(ctx: CanvasRenderingContext2D, msg: string): void {
    ctx.save();
    ctx.fillStyle = "rgba(200,30,30,0.95)";
    ctx.font = "22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(msg, ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.restore();
  },

  // Usa utilitários geométricos centralizados
  pointInRect: GeometryUtils.pointInRect,
  rayCircleIntersectT: GeometryUtils.rayCircleIntersectT,
};

if (typeof window !== "undefined") {
  (window as any).Renderer = RendererImpl;
}
