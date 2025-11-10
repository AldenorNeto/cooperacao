interface FitnessPoint {
  generation: number;
  fitness: number;
  delivered: number;
  totalDelivered?: number;
  timestamp: number;
}

interface ChartManagerInterface {
  fitnessHistory: FitnessPoint[];
  maxHistory: number;
  storageKey: string;
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  loadFromStorage?(): void;

  init(): boolean;
  setupCanvas(): void;
  addFitnessPoint(
    generation: number,
    fitness: number,
    delivered: number,
    totalDelivered?: number
  ): void;

  draw(): void;

  drawAxes(
    ctx: CanvasRenderingContext2D,
    padding: number,
    width: number,
    height: number,
    minGen: number,
    maxGen: number,
    minFit: number,
    maxFit: number
  ): void;

  drawFitnessLine(
    ctx: CanvasRenderingContext2D,
    padding: number,
    chartWidth: number,
    chartHeight: number,
    minGen: number,
    maxGen: number,
    minFit: number,
    maxFit: number
  ): void;

  drawDeliveryPoints(
    ctx: CanvasRenderingContext2D,
    padding: number,
    chartWidth: number,
    chartHeight: number,
    minGen: number,
    maxGen: number,
    minFit: number,
    maxFit: number
  ): void;

  drawTotalDeliveryLine(
    ctx: CanvasRenderingContext2D,
    padding: number,
    chartWidth: number,
    chartHeight: number,
    minGen: number,
    maxGen: number
  ): void;
}

// implementação tipada (cole no seu .ts)
const ChartManagerImpl: ChartManagerInterface = {
  fitnessHistory: [],
  maxHistory: 100,
  storageKey: "cooperacao_fitness_history",
  canvas: null,
  ctx: null,

  init(): boolean {
    this.canvas = document.getElementById(
      "fitnessChart"
    ) as HTMLCanvasElement | null;
    if (!this.canvas) return false;

    this.ctx = this.canvas.getContext("2d");
    this.loadFromStorage?.();
    this.setupCanvas();
    return true;
  },

  setupCanvas(): void {
    if (!this.canvas) return;
    this.canvas.width = 400;
    this.canvas.height = 200;
    this.canvas.style.border = "1px solid #444";
    this.canvas.style.backgroundColor = "#1a1a1a";
  },

  addFitnessPoint(
    generation: number,
    fitness: number,
    delivered: number,
    totalDelivered: number = 0
  ): void {
    this.fitnessHistory.push({
      generation,
      fitness,
      delivered,
      totalDelivered,
      timestamp: Date.now(),
    });

    if (this.fitnessHistory.length > this.maxHistory) {
      this.fitnessHistory.shift();
    }

    this.draw();
  },

  draw(): void {
    if (!this.ctx || !this.canvas || this.fitnessHistory.length < 1) return;

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (this.fitnessHistory.length === 0) {
      ctx.fillStyle = "#666";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Aguardando dados...", width / 2, height / 2);
      return;
    }

    const minGen = Math.min(...this.fitnessHistory.map((p) => p.generation));
    const maxGen = Math.max(...this.fitnessHistory.map((p) => p.generation));
    const minFit = Math.min(...this.fitnessHistory.map((p) => p.fitness));
    const maxFit = Math.max(...this.fitnessHistory.map((p) => p.fitness));

    const fitRange = maxFit - minFit || 1;
    const adjustedMinFit = minFit - fitRange * 0.1;
    const adjustedMaxFit = maxFit + fitRange * 0.1;

    const padding = 30;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;

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

    this.drawTotalDeliveryLine(
      ctx,
      padding,
      chartWidth,
      chartHeight,
      minGen,
      maxGen
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

    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.stroke();

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

    const genRange = maxGen - minGen || 1;
    const fitRange = maxFit - minFit || 1;

    ctx.strokeStyle = "#58a6ff";
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < this.fitnessHistory.length; i++) {
      const point = this.fitnessHistory[i];
      const x = padding + ((point.generation - minGen) / genRange) * chartWidth;
      const y =
        padding +
        chartHeight -
        ((point.fitness - minFit) / fitRange) * chartHeight;

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
    if (this.fitnessHistory.length === 0) return;

    const genRange = maxGen - minGen || 1;
    const fitRange = maxFit - minFit || 1;

    ctx.fillStyle = "#2fd28f";

    for (const point of this.fitnessHistory) {
      if (point.delivered > 0) {
        const x =
          padding + ((point.generation - minGen) / genRange) * chartWidth;
        const y =
          padding +
          chartHeight -
          ((point.fitness - minFit) / fitRange) * chartHeight;

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  drawTotalDeliveryLine(
    ctx: CanvasRenderingContext2D,
    padding: number,
    chartWidth: number,
    chartHeight: number,
    minGen: number,
    maxGen: number
  ): void {
    if (this.fitnessHistory.length < 2) return;

    const maxTotal = Math.max(
      ...this.fitnessHistory.map((p) => p.totalDelivered || 0)
    );
    if (maxTotal === 0) return;

    ctx.strokeStyle = "#ff6b35";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();

    const genRange = maxGen - minGen || 1;

    for (let i = 0; i < this.fitnessHistory.length; i++) {
      const point = this.fitnessHistory[i];
      const x = padding + ((point.generation - minGen) / genRange) * chartWidth;
      const y =
        padding +
        chartHeight -
        ((point.totalDelivered || 0) / maxTotal) * (chartHeight * 0.3);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#ff6b35";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Total: ${maxTotal}`, padding + 5, padding + 15);
  },
};

if (typeof window !== "undefined") {
  (window as any).ChartManager = ChartManagerImpl;
}
