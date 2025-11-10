// Tipos locais para DOMManager
interface DOMButtons {
  start: HTMLElement | null;
  reset: HTMLElement | null;
  save: HTMLElement | null;
  load: HTMLElement | null;
}

interface ConfigDisplayElements {
  pop: HTMLElement | null;
  sigma: HTMLElement | null;
  genTime: HTMLElement | null;
  speed: HTMLElement | null;
}

interface LabelElements {
  best: HTMLElement | null;
  bestdel: HTMLElement | null;
  popSize: HTMLElement | null;
}

interface OtherElements {
  champJson: HTMLElement | null;
  champInfo: HTMLElement | null;
  debugBox: HTMLElement | null;
}

interface DOMElements {
  canvas: HTMLCanvasElement | null;
  buttons: DOMButtons;
  configDisplay: ConfigDisplayElements;
  labels: LabelElements;
  other: OtherElements;
}

// Interface pública do manager
interface DOMManagerInterface {
  elements: DOMElements | null;

  init(): DOMElements | null;
  resizeCanvas(): void;
  updateUI(sim: Simulation): void;
  setupInputs?(): void;

  drawRedText(ctx: CanvasRenderingContext2D, msg: string): void;
  drawUI(ctx: CanvasRenderingContext2D, sim: Simulation): void;
  drawEnvironment(ctx: CanvasRenderingContext2D, world: World): void;
  drawAgents(
    ctx: CanvasRenderingContext2D,
    pop: Agent[],
    sim: Simulation,
    world: World
  ): void;
}

// Implementação tipada
const DOMManagerImpl: DOMManagerInterface = {
  elements: null,

  init(): DOMElements | null {
    const elements: DOMElements = {
      canvas: document.getElementById("c") as HTMLCanvasElement | null,
      buttons: {
        start: document.getElementById("btnStart"),
        reset: document.getElementById("btnReset"),
        save: document.getElementById("btnSave"),
        load: document.getElementById("btnLoad"),
      },
      configDisplay: {
        pop: document.getElementById("configPop"),
        sigma: document.getElementById("configSigma"),
        genTime: document.getElementById("configGenTime"),
        speed: document.getElementById("configSpeed"),
      },
      labels: {
        best: document.getElementById("best"),
        bestdel: document.getElementById("bestdel"),
        popSize: document.getElementById("popSizeLbl"),
      },
      other: {
        champJson: document.getElementById("champJson"),
        champInfo: document.getElementById("champInfo"),
        debugBox: document.getElementById("debugBox"),
      },
    };

    this.elements = elements;
    return this.elements;
  },

  resizeCanvas(): void {
    const cvs = this.elements?.canvas;
    if (!cvs) return;
    const rect = cvs.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    cvs.width = Math.max(640, Math.floor((window.innerWidth - 420) * ratio));
    cvs.height = Math.max(420, Math.floor(window.innerHeight * ratio));
    cvs.style.width = window.innerWidth - 420 + "px";
    cvs.style.height = window.innerHeight + "px";
  },

  updateUI(sim: Simulation): void {
    const e = this.elements;
    if (!e) return;

    if (e.configDisplay.pop)
      e.configDisplay.pop.innerText = String(1 + (sim.lambda ?? 0));
    if (e.configDisplay.sigma)
      e.configDisplay.sigma.innerText =
        (sim.sigma ?? 0).toFixed?.(2) ?? String(sim.sigma ?? 0);
    if (e.configDisplay.genTime)
      e.configDisplay.genTime.innerText = String(sim.genSeconds ?? "");
    if (e.configDisplay.speed)
      e.configDisplay.speed.innerText = String(sim.speed ?? "");
  },

  setupInputs(): void {
    const e = this.elements;
    if (!e) return;
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

  drawUI(ctx: CanvasRenderingContext2D, sim: Simulation): void {
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
    ctx.fillText(`Pop: ${sim.population?.length ?? 0}`, 200, 80);
    ctx.restore();
  },

  drawEnvironment(ctx: CanvasRenderingContext2D, world: World): void {
    ctx.fillStyle = "#2b2f37";
    for (const ob of world.obstacles) {
      ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
    }

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

    ctx.beginPath();
    ctx.fillStyle = "#fff1a8";
    ctx.strokeStyle = "#d9b24a";
    ctx.arc(world.base.x, world.base.y, world.base.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  },

  drawAgents(
    ctx: CanvasRenderingContext2D,
    pop: Agent[],
    sim: Simulation,
    world: World
  ): void {
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

    for (const a of pop) {
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

    if (pop[0]) {
      ctx.beginPath();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.arc(pop[0].x, pop[0].y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
};

// ligação tipada ao window
if (typeof window !== "undefined") {
  (window as any).DOMManager = DOMManagerImpl;
}

