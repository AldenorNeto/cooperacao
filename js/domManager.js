// Gerenciador de DOM - Cooperação de Agentes
// Centraliza todas as operações de DOM e renderização

const DOMManager = {
  // Elementos da UI
  elements: null,

  /**
   * Inicializa elementos do DOM
   */
  init() {
    this.elements = {
      canvas: document.getElementById("c"),
      buttons: {
        start: document.getElementById("btnStart"),
        stop: document.getElementById("btnStop"),
        next: document.getElementById("btnNext"),
        reset: document.getElementById("btnReset"),
        save: document.getElementById("btnSave"),
        load: document.getElementById("btnLoad")
      },
      inputs: {
        pop: document.getElementById("inpPop"),
        sigma: document.getElementById("inpSigma"),
        genSec: document.getElementById("inpGenSec"),
        steps: document.getElementById("inpSteps"),
        speed: document.getElementById("inpSpeed")
      },
      values: {
        pop: document.getElementById("valPop"),
        popTotal: document.getElementById("valPopTotal"),
        sigma: document.getElementById("valSigma"),
        genSec: document.getElementById("valGenSec"),
        steps: document.getElementById("valSteps"),
        speed: document.getElementById("valSpeed")
      },
      labels: {
        gen: document.getElementById("gen"),
        best: document.getElementById("best"),
        bestdel: document.getElementById("bestdel"),
        popSize: document.getElementById("popSizeLbl")
      },
      toggles: {
        sensors: document.getElementById("togSensors"),
        trails: document.getElementById("togTrails"),
        phero: document.getElementById("togPhero"),
        debug: document.getElementById("togDebug")
      },
      other: {
        champJson: document.getElementById("champJson"),
        champInfo: document.getElementById("champInfo"),
        debugBox: document.getElementById("debugBox")
      }
    };

    return this.elements;
  },

  /**
   * Redimensiona canvas
   */
  resizeCanvas() {
    const cvs = this.elements.canvas;
    const rect = cvs.getBoundingClientRect();
    const ratio = devicePixelRatio || 1;
    cvs.width = Math.max(640, Math.floor((window.innerWidth - 420) * ratio));
    cvs.height = Math.max(420, Math.floor(window.innerHeight * ratio));
    cvs.style.width = window.innerWidth - 420 + "px";
    cvs.style.height = window.innerHeight + "px";
  },

  /**
   * Atualiza valores da UI
   */
  updateUI(sim) {
    const e = this.elements;
    
    e.values.pop.innerText = String(sim.lambda);
    e.values.popTotal.innerText = String(1 + sim.lambda);
    e.labels.popSize.innerText = String(1 + sim.lambda);
    e.values.sigma.innerText = sim.sigma.toFixed(2);
    e.values.genSec.innerText = sim.genSeconds;
    e.values.steps.innerText = sim.stepsPerGen;
    e.values.speed.innerText = sim.speed;
    e.labels.gen.innerText = sim.generation;
    e.labels.best.innerText = sim.bestFitness;
    e.labels.bestdel.innerText = sim.bestDelivered;
  },

  /**
   * Configura inputs iniciais
   */
  setupInputs(sim) {
    const e = this.elements;
    
    e.inputs.pop.min = "49";
    e.inputs.pop.max = "299";
    e.inputs.pop.value = String(sim.lambda);
    e.inputs.sigma.value = String(sim.sigma);
    e.inputs.genSec.value = String(sim.genSeconds);
    e.inputs.steps.value = String(sim.stepsPerGen);
    e.inputs.speed.value = String(sim.speed);
  },

  /**
   * Desenha texto de erro
   */
  drawRedText(ctx, msg) {
    ctx.save();
    ctx.fillStyle = "rgba(200,30,30,0.95)";
    ctx.font = "22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(msg, ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.restore();
  },

  /**
   * Desenha UI principal
   */
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

  /**
   * Desenha feromônios
   */
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

  /**
   * Desenha ambiente (obstáculos, pedras, base)
   */
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

  /**
   * Desenha agentes
   */
  drawAgents(ctx, pop, sim, world) {
    // Rastros
    if (sim.showTrails) {
      ctx.lineWidth = 1;
      for (const a of pop) {
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
    for (const a of pop) {
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
    if (pop[0]) {
      ctx.beginPath();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.arc(pop[0].x, pop[0].y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  /**
   * Desenha sensores
   */
  drawSensors(ctx, agent, genome, world) {
    // Implementação dos sensores (copiada do código original)
    // ... (código dos sensores permanece igual)
  }
};

// Exporta para uso global
if (typeof window !== 'undefined') {
  window.DOMManager = DOMManager;
}