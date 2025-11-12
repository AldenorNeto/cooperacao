const RendererImpl = {
  // Controles de câmera
  camera: {
    x: 0,
    y: 0,
    zoom: 1,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
  },

  // Projeção isométrica 3D com câmera
  project3D(x: number, y: number, z: number = 0): { x: number; y: number } {
    const iso = {
      x: (x - y) * 0.866, // cos(30°)
      y: (x + y) * 0.5 - z * 0.8,
    };
    return {
      x: iso.x * this.camera.zoom + this.camera.x + 400,
      y: iso.y * this.camera.zoom + this.camera.y + 300,
    };
  },

  // Inicializa controles de câmera
  initCameraControls(canvas: HTMLCanvasElement): void {
    // Mouse down
    canvas.addEventListener("mousedown", (e) => {
      this.camera.isDragging = true;
      this.camera.lastMouseX = e.clientX;
      this.camera.lastMouseY = e.clientY;
      canvas.style.cursor = "grabbing";
    });

    // Mouse move
    canvas.addEventListener("mousemove", (e) => {
      if (this.camera.isDragging) {
        const deltaX = e.clientX - this.camera.lastMouseX;
        const deltaY = e.clientY - this.camera.lastMouseY;

        this.camera.x += deltaX;
        this.camera.y += deltaY;

        this.camera.lastMouseX = e.clientX;
        this.camera.lastMouseY = e.clientY;
      }
    });

    // Mouse up
    canvas.addEventListener("mouseup", () => {
      this.camera.isDragging = false;
      canvas.style.cursor = "grab";
    });

    // Mouse leave
    canvas.addEventListener("mouseleave", () => {
      this.camera.isDragging = false;
      canvas.style.cursor = "default";
    });

    // Wheel zoom
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.camera.zoom = Math.max(
        0.3,
        Math.min(3, this.camera.zoom * zoomFactor)
      );
    });

    // Estilo inicial
    canvas.style.cursor = "grab";
  },

  draw(world: World, population: Agent[], sim: Simulation): void {
    const ctx = sim.ctx;
    ctx.clearRect(0, 0, sim.canvas.width, sim.canvas.height);

    if (!sim.canvas.dataset.cameraInit) {
      this.initCameraControls(sim.canvas);
      sim.canvas.dataset.cameraInit = "true";
    }

    this.drawEnvironment(ctx, world);
    this.drawAgents(ctx, population);
    
    // Desenha sensores no modo debug
    if (sim.debugMode && population[0]) {
      this.drawSensors(ctx, population[0]);
    }
    
    // Desenha linha de rastreamento para agente do debug
    if (sim.trackedAgent) {
      this.drawTrackingLine(ctx, sim.trackedAgent, sim.canvas);
    }
    
    this.drawUI(ctx, sim);
    this.drawCameraInfo(ctx);
  },

  drawEnvironment(ctx: CanvasRenderingContext2D, world: World): void {
    // Chão (grid isométrico adaptativo)
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 0.5 * this.camera.zoom;
    const gridSize = Math.max(20, 40 / this.camera.zoom);

    for (let i = 0; i <= 800; i += gridSize) {
      const start = this.project3D(i, 0);
      const end = this.project3D(i, 600);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    for (let j = 0; j <= 600; j += gridSize) {
      const start = this.project3D(0, j);
      const end = this.project3D(800, j);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    // Obstáculos (cubos 3D)
    ctx.fillStyle = "#2b2f37";
    ctx.strokeStyle = "#444";
    for (const ob of world.obstacles) {
      const height = 30;
      const corners = [
        this.project3D(ob.x, ob.y),
        this.project3D(ob.x + ob.w, ob.y),
        this.project3D(ob.x + ob.w, ob.y + ob.h),
        this.project3D(ob.x, ob.y + ob.h),
        this.project3D(ob.x, ob.y, height),
        this.project3D(ob.x + ob.w, ob.y, height),
        this.project3D(ob.x + ob.w, ob.y + ob.h, height),
        this.project3D(ob.x, ob.y + ob.h, height),
      ];

      // Face superior
      ctx.beginPath();
      ctx.moveTo(corners[4].x, corners[4].y);
      ctx.lineTo(corners[5].x, corners[5].y);
      ctx.lineTo(corners[6].x, corners[6].y);
      ctx.lineTo(corners[7].x, corners[7].y);
      ctx.closePath();
      ctx.fillStyle = "#3a3f47";
      ctx.fill();
      ctx.stroke();

      // Face direita
      ctx.beginPath();
      ctx.moveTo(corners[1].x, corners[1].y);
      ctx.lineTo(corners[5].x, corners[5].y);
      ctx.lineTo(corners[6].x, corners[6].y);
      ctx.lineTo(corners[2].x, corners[2].y);
      ctx.closePath();
      ctx.fillStyle = "#2b2f37";
      ctx.fill();
      ctx.stroke();

      // Face esquerda
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      ctx.lineTo(corners[4].x, corners[4].y);
      ctx.lineTo(corners[7].x, corners[7].y);
      ctx.lineTo(corners[3].x, corners[3].y);
      ctx.closePath();
      ctx.fillStyle = "#1f2329";
      ctx.fill();
      ctx.stroke();
    }

    // Pedras (esferas 3D)
    for (const s of world.stones) {
      const pos = this.project3D(s.x, s.y, s.r);

      // Sombra
      const shadowPos = this.project3D(s.x + 2, s.y + 2);
      ctx.beginPath();
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.ellipse(
        shadowPos.x,
        shadowPos.y,
        s.r * 0.8,
        s.r * 0.4,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Esfera principal
      ctx.beginPath();
      ctx.fillStyle = s.quantity > 0 ? "#a9a089" : "#444";
      ctx.arc(pos.x, pos.y, s.r, 0, Math.PI * 2);
      ctx.fill();

      // Highlight 3D
      ctx.beginPath();
      ctx.fillStyle = s.quantity > 0 ? "#c4c0a5" : "#666";
      ctx.arc(pos.x - s.r * 0.3, pos.y - s.r * 0.3, s.r * 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#111";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, s.r, 0, Math.PI * 2);
      ctx.stroke();

      // Texto
      ctx.fillStyle = "#dff";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.quantity.toString(), pos.x, pos.y);
    }

    // Base (cilindro 3D)
    const basePos = this.project3D(world.base.x, world.base.y);
    const basePosTop = this.project3D(world.base.x, world.base.y, 15);

    // Sombra da base
    const baseShadow = this.project3D(world.base.x + 3, world.base.y + 3);
    ctx.beginPath();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.ellipse(
      baseShadow.x,
      baseShadow.y,
      world.base.r * 0.9,
      world.base.r * 0.5,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Lateral do cilindro
    ctx.beginPath();
    ctx.fillStyle = "#660000";
    ctx.ellipse(
      basePos.x,
      basePos.y,
      world.base.r,
      world.base.r * 0.5,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Topo do cilindro
    ctx.beginPath();
    ctx.fillStyle = "#8B0000";
    ctx.ellipse(
      basePosTop.x,
      basePosTop.y,
      world.base.r,
      world.base.r * 0.5,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.strokeStyle = "#FF0000";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Contador de pedras na base
    ctx.fillStyle = "#FFF";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(world.stonesDelivered.toString(), basePosTop.x, basePosTop.y);
  },

  drawAgents(ctx: CanvasRenderingContext2D, population: Agent[]): void {
    // Ordena agentes por profundidade (y + x para isométrico)
    const sortedAgents = [...population].sort(
      (a, b) => a.y + a.x - (b.y + b.x)
    );

    // Agentes (como pequenos robôs 3D)
    for (const a of sortedAgents) {
      const pos = this.project3D(a.x, a.y, 8);

      // Sombra do agente
      const shadowPos = this.project3D(a.x + 1, a.y + 1);
      ctx.beginPath();
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.ellipse(shadowPos.x, shadowPos.y, 4, 2, 0, 0, Math.PI * 2);
      ctx.fill();

      const colors = {
        "SEEK": "#58a6ff",
        "MINING": "#ff9a4d", 
        "CARRYING": "#2fd28f"
      };
      let col = colors[a.state];

      // Corpo do agente (esfera)
      ctx.beginPath();
      ctx.fillStyle = col;
      ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Highlight 3D
      ctx.beginPath();
      ctx.fillStyle = this.lightenColor(col);
      ctx.arc(pos.x - 2, pos.y - 2, 2, 0, Math.PI * 2);
      ctx.fill();

      // Direção (seta 3D)
      const dirX = Math.cos(a.a) * 8;
      const dirY = Math.sin(a.a) * 8;
      const dirPos = this.project3D(a.x + dirX, a.y + dirY, 8);

      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(dirPos.x, dirPos.y);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Ponta da seta
      ctx.beginPath();
      ctx.fillStyle = "#fff";
      ctx.arc(dirPos.x, dirPos.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Destaca elites
    for (const a of population) {
      if (a.formaDeNascimento === 'elite') {
        const elitePos = this.project3D(a.x, a.y, 8);
        ctx.beginPath();
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 3;
        ctx.arc(elitePos.x, elitePos.y, 12, 0, Math.PI * 2);
        ctx.stroke();
        
        // Anel duplo para elites
        ctx.beginPath();
        ctx.strokeStyle = "#ffff00";
        ctx.lineWidth = 1;
        ctx.arc(elitePos.x, elitePos.y, 15, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    
    // Destaca campeão
    if (population[0]) {
      const champPos = this.project3D(population[0].x, population[0].y, 8);
      ctx.beginPath();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.arc(champPos.x, champPos.y, 9, 0, Math.PI * 2);
      ctx.stroke();

      // Anel de destaque acima
      const ringPos = this.project3D(population[0].x, population[0].y, 20);
      ctx.beginPath();
      ctx.strokeStyle = "#ffff00";
      ctx.lineWidth = 1;
      ctx.arc(ringPos.x, ringPos.y, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  lightenColor(color: string): string {
    // Simplificado para evitar erros TypeScript
    const colors: { [key: string]: string } = {
      "#2fd28f": "rgb(80, 230, 170)",
      "#58a6ff": "rgb(120, 186, 255)",
      "#ff9a4d": "rgb(255, 174, 107)",
      "#ffd56b": "rgb(255, 223, 137)",
    };
    return colors[color] || color;
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

  drawCameraInfo(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = "rgba(2,6,10,0.35)";
    ctx.fillRect(ctx.canvas.width - 160, 8, 150, 60);
    ctx.fillStyle = "#cfe7ff";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      `Zoom: ${this.camera.zoom.toFixed(1)}x`,
      ctx.canvas.width - 150,
      26
    );
    ctx.fillText(`Arraste para mover`, ctx.canvas.width - 150, 44);
    ctx.fillText(`Scroll para zoom`, ctx.canvas.width - 150, 58);
    ctx.restore();
  },

  drawSensors(ctx: CanvasRenderingContext2D, agent: Agent): void {
    if (agent.sensorData) {
      const agentPos = this.project3D(agent.x, agent.y, 8);
      ctx.save();
      ctx.translate(agentPos.x, agentPos.y);

      for (let i = 0; i < agent.sensorData.length; i++) {
        const sensor = agent.sensorData[i];
        const angle = agent.a + sensor.angle;
        const maxRange = sensor.range;
        const hitDistance = sensor.endDistance;
        
        // Linha do sensor até o alcance máximo
        const maxX = Math.cos(angle) * maxRange;
        const maxY = Math.sin(angle) * maxRange;
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(maxX, maxY);
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Linha até o ponto de colisão
        if (hitDistance < maxRange) {
          const hitX = Math.cos(angle) * hitDistance;
          const hitY = Math.sin(angle) * hitDistance;
          
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(hitX, hitY);
          ctx.strokeStyle = `rgba(255, 255, 0, ${0.5 + sensor.proximity * 0.5})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Ponto de colisão
          ctx.beginPath();
          ctx.fillStyle = sensor.stoneSignal > 0 ? 'rgba(255, 165, 0, 0.8)' : 
                         sensor.baseSignal > 0 ? 'rgba(255, 0, 0, 0.8)' : 
                         'rgba(255, 255, 0, 0.8)';
          ctx.arc(hitX, hitY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Cone de detecção
        const coneAngle = Math.PI / 12; // 15 graus
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, maxRange * 0.3, angle - coneAngle, angle + coneAngle);
        ctx.closePath();
        ctx.fillStyle = `rgba(255, 255, 0, ${0.1 + sensor.proximity * 0.1})`;
        ctx.fill();
      }

      ctx.restore();
    }
  },

  drawTrackingLine(ctx: CanvasRenderingContext2D, agent: Agent, canvas: HTMLCanvasElement): void {
    const agentPos = this.project3D(agent.x, agent.y, 8);
    const targetX = canvas.width;
    const targetY = canvas.height;
    
    ctx.save();
    ctx.strokeStyle = "rgba(255, 215, 0, 0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    ctx.beginPath();
    ctx.moveTo(agentPos.x, agentPos.y);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    
    // Ponto no canto
    ctx.fillStyle = "rgba(255, 215, 0, 0.9)";
    ctx.beginPath();
    ctx.arc(targetX - 10, targetY - 10, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
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
