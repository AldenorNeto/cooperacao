const ChartManagerImpl = {
  fitnessHistory: [],
  maxHistory: 100,
  storageKey: "cooperacao_fitness_history",
  canvas: null,
  ctx: null,

  init(): boolean {
    this.canvas = document.getElementById("fitnessChart");
    if (!this.canvas) return false;

    this.ctx = this.canvas.getContext("2d");
    this.loadFromStorage();
    this.setupCanvas();
    return true;
  },

  setupCanvas(): void {
    this.canvas.width = 400;
    this.canvas.height = 200;
    this.canvas.style.border = "1px solid #444";
    this.canvas.style.backgroundColor = "#1a1a1a";
  },

  addFitnessPoint(
    generation: number,
    fitness: number,
    delivered: number
  ): void {
    this.fitnessHistory.push({
      generation,
      fitness,
      delivered,
      timestamp: Date.now(),
    });

    if (this.fitnessHistory.length > this.maxHistory) {
      this.fitnessHistory.shift();
    }

    this.saveToStorage();
    this.draw();
  },

  draw(): void {
    if (!this.ctx || this.fitnessHistory.length < 1) return;

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Limpa canvas
    ctx.clearRect(0, 0, width, height);

    if (this.fitnessHistory.length === 0) {
      ctx.fillStyle = "#666";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Aguardando dados...", width / 2, height / 2);
      return;
    }

    // Calcula limites dos dados
    const minGen = Math.min(...this.fitnessHistory.map((p) => p.generation));
    const maxGen = Math.max(...this.fitnessHistory.map((p) => p.generation));
    const minFit = Math.min(...this.fitnessHistory.map((p) => p.fitness));
    const maxFit = Math.max(...this.fitnessHistory.map((p) => p.fitness));

    // Adiciona margem nos valores para melhor visualização
    const fitRange = maxFit - minFit;
    const adjustedMinFit = minFit - fitRange * 0.1;
    const adjustedMaxFit = maxFit + fitRange * 0.1;

    const padding = 30;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;

    // Desenha eixos
    this.drawAxes(
      ctx,
      padding,
      width,
      height,
      minGen,
      maxGen,
      adjustedMinFit,
      adjustedMaxFit
    );

    // Desenha linha do fitness
    this.drawFitnessLine(
      ctx,
      padding,
      chartWidth,
      chartHeight,
      minGen,
      maxGen,
      adjustedMinFit,
      adjustedMaxFit
    );

    // Desenha pontos de entrega
    this.drawDeliveryPoints(
      ctx,
      padding,
      chartWidth,
      chartHeight,
      minGen,
      maxGen,
      adjustedMinFit,
      adjustedMaxFit
    );
  },

  drawAxes(
    ctx: CanvasRenderingContext2D,
    padding: number,
    width: number,
    height: number,
    minGen: number,
    maxGen: number,
    minFit: number,
    maxFit: number
  ): void {
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.font = "10px monospace";
    ctx.fillStyle = "#ccc";

    // Eixo X
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Eixo Y
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.stroke();

    // Labels
    ctx.textAlign = "center";
    ctx.fillText(`Gen ${minGen}`, padding, height - 10);
    ctx.fillText(`Gen ${maxGen}`, width - padding, height - 10);

    ctx.textAlign = "right";
    ctx.fillText(minFit.toFixed(0), padding - 5, height - padding);
    ctx.fillText(maxFit.toFixed(0), padding - 5, padding + 5);
  },

  drawFitnessLine(
    ctx: CanvasRenderingContext2D,
    padding: number,
    chartWidth: number,
    chartHeight: number,
    minGen: number,
    maxGen: number,
    minFit: number,
    maxFit: number
  ): void {
    if (this.fitnessHistory.length < 2) return;

    ctx.strokeStyle = "#58a6ff";
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < this.fitnessHistory.length; i++) {
      const point = this.fitnessHistory[i];
      const x =
        padding +
        ((point.generation - minGen) / (maxGen - minGen)) * chartWidth;
      const y =
        padding +
        chartHeight -
        ((point.fitness - minFit) / (maxFit - minFit)) * chartHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  },

  drawDeliveryPoints(
    ctx: CanvasRenderingContext2D,
    padding: number,
    chartWidth: number,
    chartHeight: number,
    minGen: number,
    maxGen: number,
    minFit: number,
    maxFit: number
  ): void {
    ctx.fillStyle = "#2fd28f";

    for (const point of this.fitnessHistory) {
      if (point.delivered > 0) {
        const x =
          padding +
          ((point.generation - minGen) / (maxGen - minGen)) * chartWidth;
        const y =
          padding +
          chartHeight -
          ((point.fitness - minFit) / (maxFit - minFit)) * chartHeight;

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  saveToStorage(): void {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify(this.fitnessHistory)
      );
    } catch (e) {
      console.warn("Erro ao salvar histórico de fitness:", e);
    }
  },

  loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.fitnessHistory = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Erro ao carregar histórico de fitness:", e);
      this.fitnessHistory = [];
    }
  },

  clearHistory(): void {
    this.fitnessHistory = [];
    localStorage.removeItem(this.storageKey);
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  },
};

if (typeof window !== "undefined") {
  (window as any).ChartManager = ChartManagerImpl;
}
