// Sistema de Renderização - Desenho da Simulação
// Centraliza todas as funções de desenho

const Renderer = {
  draw(world, population, sim) {
    const ctx = sim.ctx;
    ctx.clearRect(0, 0, sim.canvas.width, sim.canvas.height);
    
    this.drawPheromones(ctx, world, sim);
    this.drawEnvironment(ctx, world);
    this.drawAgents(ctx, population, sim, world);
    this.drawUI(ctx, sim);
  },

  drawPheromones(ctx, world, sim) {
    if (!sim.showPhero) return;
    
    const cols = world.pherCols, rows = world.pherRows;
    const cw = sim.canvas.width / cols, ch = sim.canvas.height / rows;
    
    ctx.globalCompositeOperation = "lighter";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = world.pher[y * cols + x];
        if (v > 0.001) {
          ctx.fillStyle = `rgba(20,120,220,${v * 0.18})`;
          ctx.fillRect(x * cw, y * ch, cw, ch);
        }
      }
    }
    ctx.globalCompositeOperation = "source-over";
  },

  drawEnvironment(ctx, world) {
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
    
    // Base
    ctx.beginPath();
    ctx.fillStyle = "#fff1a8";
    ctx.strokeStyle = "#d9b24a";
    ctx.arc(world.base.x, world.base.y, world.base.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  },

  drawAgents(ctx, population, sim, world) {
    // Trilhas
    if (sim.showTrails) {
      ctx.lineWidth = 1;
      for (const a of population) {
        if (a.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(a.trail[0].x, a.trail[0].y);
          for (let i = 1; i < a.trail.length; i++) {
            ctx.lineTo(a.trail[i].x, a.trail[i].y);
          }
          ctx.strokeStyle = "rgba(255,255,255,0.03)";
          ctx.stroke();
        }
      }
    }
    
    // Agentes
    for (const a of population) {
      if (sim.showSensors) this.drawSensors(ctx, a, a.genome, world);
      
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

  drawUI(ctx, sim) {
    ctx.save();
    ctx.fillStyle = "rgba(2,6,10,0.35)";
    ctx.fillRect(8, 8, 340, 96);
    ctx.fillStyle = "#cfe7ff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Gen: ${sim.generation}`, 14, 26);
    ctx.fillText(`Best fit: ${sim.bestFitness}`, 14, 44);
    ctx.fillText(`Delivered: ${sim.bestDelivered}`, 14, 62);
    ctx.fillText(`Steps: ${sim.genStepCount}/${sim.stepsPerGen}`, 14, 80);
    ctx.fillText(`Pop: ${sim.population.length}`, 200, 80);
    ctx.restore();
  },

  drawSensors(ctx, agent, genome, world) {
    const range = genome.sensorRange;
    for (let si = 0; si < 5; si++) {
      const ang = agent.a + genome.sensorAngles[si];
      let tObstacle = Infinity;
      
      for (let t = 4; t <= range; t += 6) {
        const sx = agent.x + Math.cos(ang) * t,
          sy = agent.y + Math.sin(ang) * t;
        if (sx < 2 || sy < 2 || sx > world.w - 2 || sy > world.h - 2) {
          tObstacle = t;
          break;
        }
        for (const ob of world.obstacles) {
          if (this.pointInRect(sx, sy, ob)) {
            tObstacle = t;
            break;
          }
        }
        if (tObstacle < Infinity) break;
      }
      
      let tStone = Infinity, tBase = Infinity;
      
      for (const s of world.stones) {
        if (s.quantity > 0) {
          const ts = this.rayCircleIntersectT(
            agent.x, agent.y, Math.cos(ang), Math.sin(ang), s.x, s.y, s.r
          );
          if (ts != null && ts >= 0 && ts <= range && ts < tObstacle)
            tStone = Math.min(tStone, ts);
        }
      }
      
      const tb = this.rayCircleIntersectT(
        agent.x, agent.y, Math.cos(ang), Math.sin(ang),
        world.base.x, world.base.y, world.base.r
      );
      if (tb != null && tb >= 0 && tb <= range && tb < tObstacle) tBase = tb;
      
      const tEnd = Math.min(tObstacle, tStone, tBase, range);
      
      ctx.beginPath();
      ctx.moveTo(agent.x, agent.y);
      ctx.lineTo(
        agent.x + Math.cos(ang) * tEnd,
        agent.y + Math.sin(ang) * tEnd
      );
      ctx.strokeStyle = tStone <= tEnd ? "#ffd89b" : tBase <= tEnd ? "#bdf7c7" : "rgba(200,220,255,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();
      
      if (tStone <= tEnd) {
        ctx.beginPath();
        ctx.fillStyle = "#ffb86b";
        ctx.arc(
          agent.x + Math.cos(ang) * tStone,
          agent.y + Math.sin(ang) * tStone,
          2.8, 0, Math.PI * 2
        );
        ctx.fill();
      }
      
      if (tBase <= tEnd) {
        ctx.beginPath();
        ctx.fillStyle = "#8effb5";
        ctx.arc(
          agent.x + Math.cos(ang) * tBase,
          agent.y + Math.sin(ang) * tBase,
          2.8, 0, Math.PI * 2
        );
        ctx.fill();
      }
    }
  },

  drawRedText(ctx, msg) {
    ctx.save();
    ctx.fillStyle = "rgba(200,30,30,0.95)";
    ctx.font = "22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(msg, ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.restore();
  },

  // Utilitários
  pointInRect(x, y, r) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  },

  rayCircleIntersectT(rx, ry, dx, dy, cx, cy, cr) {
    const ox = rx - cx, oy = ry - cy;
    const a = dx * dx + dy * dy;
    const b = 2 * (ox * dx + oy * dy);
    const c = ox * ox + oy * oy - cr * cr;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const t1 = (-b - s) / (2 * a), t2 = (-b + s) / (2 * a);
    if (t1 >= 0) return t1;
    if (t2 >= 0) return t2;
    return null;
  }
};

if (typeof window !== 'undefined') {
  window.Renderer = Renderer;
}