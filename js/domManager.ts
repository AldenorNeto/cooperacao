interface SimpleDOMElements {
  canvas: HTMLCanvasElement;
  buttons: {
    start: HTMLElement;
    pause: HTMLElement;
    reset: HTMLElement;
    debug: HTMLElement;
    downloadDebug: HTMLElement;
  };
  rangeControls: {
    speedRange: HTMLInputElement;
    speedValue: HTMLElement;
    genTimeRange: HTMLInputElement;
    genTimeValue: HTMLElement;
    stepsRange: HTMLInputElement;
    stepsValue: HTMLElement;
  };
  stonesDelivered: HTMLElement;
  debugPanel: HTMLElement;
  debugElements: {
    agentPos: HTMLElement;
    agentAngle: HTMLElement;
    agentVel: HTMLElement;
    agentState: HTMLElement;
    agentCarry: HTMLElement;
    agentFitness: HTMLElement;
    sensorValues: HTMLElement;
    networkInputs: HTMLElement;
    networkOutputs: HTMLElement;
    neuralCanvas: HTMLCanvasElement;
    historyCanvas: HTMLCanvasElement;
  };
}

interface HistoryPoint {
  step: number;
  memoryAngle: number;
  memoryDist: number;
  agentAngle: number;
}

const DOMManagerImpl: DOMManagerInterface = {
  elements: null as SimpleDOMElements | null,
  history: [] as HistoryPoint[],
  maxHistoryPoints: 200,
  sampleInterval: 10, // Salva a cada 10 steps

  init(): SimpleDOMElements | null {
    this.elements = {
      canvas: document.getElementById("c") as HTMLCanvasElement,
      buttons: {
        start: document.getElementById("btnStart")!,
        pause: document.getElementById("btnPause")!,
        reset: document.getElementById("btnReset")!,
        debug: document.getElementById("btnDebug")!,
        downloadDebug: document.getElementById("btnDownloadDebug")!,
      },
      rangeControls: {
        speedRange: document.getElementById("speedRange") as HTMLInputElement,
        speedValue: document.getElementById("speedValue")!,
        genTimeRange: document.getElementById(
          "genTimeRange"
        ) as HTMLInputElement,
        genTimeValue: document.getElementById("genTimeValue")!,
        stepsRange: document.getElementById("stepsRange") as HTMLInputElement,
        stepsValue: document.getElementById("stepsValue")!,
      },
      stonesDelivered: document.getElementById("stonesDelivered")!,
      debugPanel: document.getElementById("debugPanel")!,
      debugElements: {
        agentPos: document.getElementById("agentPos")!,
        agentAngle: document.getElementById("agentAngle")!,
        agentVel: document.getElementById("agentVel")!,
        agentState: document.getElementById("agentState")!,
        agentCarry: document.getElementById("agentCarry")!,
        agentFitness: document.getElementById("agentFitness")!,
        sensorValues: document.getElementById("sensorValues")!,
        networkInputs: document.getElementById("networkInputs")!,
        networkOutputs: document.getElementById("networkOutputs")!,
        neuralCanvas: document.getElementById(
          "neuralCanvas"
        ) as HTMLCanvasElement,
        historyCanvas: document.getElementById(
          "historyCanvas"
        ) as HTMLCanvasElement,
      },
    };
    return this.elements;
  },

  resizeCanvas(): void {
    const cvs = this.elements?.canvas;
    if (!cvs) return;
    const ratio = window.devicePixelRatio || 1;
    cvs.width = Math.max(640, Math.floor((window.innerWidth - 420) * ratio));
    cvs.height = Math.max(420, Math.floor(window.innerHeight * ratio));
    cvs.style.width = window.innerWidth - 420 + "px";
    cvs.style.height = window.innerHeight + "px";
  },

  setupInputs(): void {
    const e = this.elements!;

    e.rangeControls.speedRange.addEventListener("input", (event) => {
      const value = (event.target as HTMLInputElement).value;
      e.rangeControls.speedValue.textContent = value;
      if ((window as unknown as WindowType).SIM) {
        (window as unknown as WindowType).SIM!.speed = parseInt(value);
      }
    });

    e.rangeControls.genTimeRange.addEventListener("input", (event) => {
      const value = (event.target as HTMLInputElement).value;
      e.rangeControls.genTimeValue.textContent = value;
      if ((window as unknown as WindowType).SIM) {
        (window as unknown as WindowType).SIM!.genSeconds = parseInt(value);
        (window as unknown as WindowType).SIM!.stepsPerGen =
          parseInt(value) * 60;
      }
    });

    e.rangeControls.stepsRange.addEventListener("input", (event) => {
      const value = (event.target as HTMLInputElement).value;
      e.rangeControls.stepsValue.textContent = value;
      if ((window as unknown as WindowType).SIM) {
        (window as unknown as WindowType).SIM!.stepsPerGen = parseInt(value);
      }
    });
  },

  updateUI(sim: Simulation): void {
    if (this.elements?.stonesDelivered) {
      this.elements.stonesDelivered.textContent = String(
        sim.world?.stonesDelivered ?? 0
      );
    }

    // Sempre mostra debug panel
    this.elements!.debugPanel.style.display = "block";

    const targetAgent = sim.debugMode
      ? sim.population[0]
      : sim.population.find((a: Agent) => a.formaDeNascimento === "elite") ||
        sim.population[0];
    if (targetAgent) {
      this.updateDebugInfo(targetAgent, sim.lastStepResult);
      // Atualiza histórico
      if (sim.lastStepResult) {
        this.updateHistory(targetAgent, sim.lastStepResult, sim.genStepCount);
      }
      // Desenha gráfico de histórico
      this.drawHistoryChart();
      // Armazena agente para linha de rastreamento
      (window as unknown as WindowType).SIM!.trackedAgent = targetAgent;
    }
  },

  updateDebugInfo(agent: Agent, stepResult: StepResult): void {
    const e = this.elements!.debugElements;

    e.agentPos.textContent = `${agent.x.toFixed(1)}, ${agent.y.toFixed(1)}`;
    e.agentAngle.textContent = `${((agent.a * 180) / Math.PI).toFixed(1)}°`;
    e.agentVel.textContent = agent.v.toFixed(3);
    e.agentState.textContent = agent.state;
    e.agentCarry.textContent = agent.state === "CARRYING" ? "true" : "false";
    e.agentFitness.textContent = agent.fitness.toFixed(2);

    if (agent.sensorData && stepResult) {
      e.sensorValues.innerHTML = "";

      // Mostra os 3 sensores com seus 3 valores cada
      agent.sensorData.forEach((sensor: SensorData, i: number) => {
        const sensorGroup = document.createElement("div");
        sensorGroup.style.marginBottom = "6px";
        sensorGroup.innerHTML = `<strong>Sensor ${i}:</strong>`;

        const proximity = document.createElement("div");
        proximity.className = `sensor-item ${sensor.proximity > 0.5 ? "sensor-active" : ""}`;
        proximity.innerHTML = `<span>Proximity:</span><span>${sensor.proximity.toFixed(3)}</span>`;

        const stone = document.createElement("div");
        stone.className = `sensor-item ${sensor.stoneSignal > 0.5 ? "sensor-active" : ""}`;
        stone.innerHTML = `<span>Stone:</span><span>${sensor.stoneSignal.toFixed(3)}</span>`;

        const base = document.createElement("div");
        base.className = `sensor-item ${sensor.baseSignal > 0.5 ? "sensor-active" : ""}`;
        base.innerHTML = `<span>Base:</span><span>${sensor.baseSignal.toFixed(3)}</span>`;

        sensorGroup.appendChild(proximity);
        sensorGroup.appendChild(stone);
        sensorGroup.appendChild(base);
        e.sensorValues.appendChild(sensorGroup);
      });

      // Adiciona memória e estado
      const memoryGroup = document.createElement("div");
      memoryGroup.style.marginTop = "8px";
      memoryGroup.innerHTML = `<strong>Memory & State:</strong>`;

      const labels = [
        "Memory Angle",
        "Memory Dist",
        "State: SEEK",
        "State: MINING",
        "State: CARRYING",
      ];

      for (let i = 15; i < Math.min(20, stepResult.inputs.length); i++) {
        const div = document.createElement("div");
        div.className = `sensor-item ${Math.abs(stepResult.inputs[i]) > 0.5 ? "sensor-active" : ""}`;
        div.innerHTML = `<span>${labels[i - 15]}:</span><span>${stepResult.inputs[i].toFixed(3)}</span>`;
        memoryGroup.appendChild(div);
      }

      e.sensorValues.appendChild(memoryGroup);
    }

    if (stepResult) {
      e.networkInputs.innerHTML = `<strong>All Network Inputs (${stepResult.inputs.length}):</strong><br>`;

      const inputLabels = [
        "S0:Prox",
        "S0:Stone",
        "S0:Base",
        "S1:Prox",
        "S1:Stone",
        "S1:Base",
        "S2:Prox",
        "S2:Stone",
        "S2:Base",
        "S3:Prox",
        "S3:Stone",
        "S3:Base",
        "S4:Prox",
        "S4:Stone",
        "S4:Base",
        "MemAngle",
        "MemDist",
        "SEEK",
        "MINING",
        "CARRYING",
      ];

      stepResult.inputs.forEach((val: number, i: number) => {
        const div = document.createElement("div");
        div.className = `network-item ${Math.abs(val) > 0.5 ? "network-high" : ""}`;
        const label = i < inputLabels.length ? inputLabels[i] : `I${i}`;
        div.innerHTML = `<span>${label}:</span><span>${val.toFixed(3)}</span>`;
        e.networkInputs.appendChild(div);
      });

      e.networkOutputs.innerHTML = "<strong>Outputs:</strong><br>";
      stepResult.outputs.forEach((val: number, i: number) => {
        const div = document.createElement("div");
        div.className = `network-item ${Math.abs(val) > 0.5 ? "network-high" : ""}`;
        const labels = ["Accel", "Rotate", "Mine"];
        div.innerHTML = `<span>${labels[i]}:</span><span>${val.toFixed(3)}</span>`;
        e.networkOutputs.appendChild(div);
      });

      const ctx = e.neuralCanvas.getContext("2d")!;
      ctx.clearRect(0, 0, e.neuralCanvas.width, e.neuralCanvas.height);

      const layers = {
        input: {
          x: 30,
          count: stepResult.inputs.length,
          values: stepResult.inputs,
        },
        hidden: { x: 150, count: agent.genome.hidden, values: [] as number[] },
        output: {
          x: 270,
          count: stepResult.outputs.length,
          values: stepResult.outputs,
        },
      };

      for (let h = 0; h < agent.genome.hidden; h++) {
        let sum = agent.genome.hiddenBiases[h];
        for (let i = 0; i < stepResult.inputs.length; i++) {
          sum +=
            stepResult.inputs[i] *
            agent.genome.hiddenWeights[h * stepResult.inputs.length + i];
        }
        layers.hidden.values[h] = Math.tanh(sum);
      }

      // Desenha conexões Input -> Hidden
      for (let i = 0; i < layers.input.count; i++) {
        for (let h = 0; h < layers.hidden.count; h++) {
          const weight = agent.genome.hiddenWeights[h * layers.input.count + i];
          const alpha = Math.min(0.8, Math.abs(weight));
          ctx.strokeStyle =
            weight > 0
              ? `rgba(0, 255, 0, ${alpha})`
              : `rgba(255, 0, 0, ${alpha})`;
          ctx.lineWidth = Math.max(0.5, Math.abs(weight) * 2);

          const y1 = 30 + i * (140 / Math.max(1, layers.input.count - 1));
          const y2 = 30 + h * (140 / Math.max(1, layers.hidden.count - 1));

          ctx.beginPath();
          ctx.moveTo(layers.input.x + 8, y1);
          ctx.lineTo(layers.hidden.x - 8, y2);
          ctx.stroke();
        }
      }

      // Desenha conexões Hidden -> Output
      for (let h = 0; h < layers.hidden.count; h++) {
        for (let o = 0; o < layers.output.count; o++) {
          const weight =
            agent.genome.outputWeights[o * layers.hidden.count + h];
          const alpha = Math.min(0.8, Math.abs(weight));
          ctx.strokeStyle =
            weight > 0
              ? `rgba(0, 255, 0, ${alpha})`
              : `rgba(255, 0, 0, ${alpha})`;
          ctx.lineWidth = Math.max(0.5, Math.abs(weight) * 2);

          const y1 = 30 + h * (140 / Math.max(1, layers.hidden.count - 1));
          const y2 = 30 + o * (140 / Math.max(1, layers.output.count - 1));

          ctx.beginPath();
          ctx.moveTo(layers.hidden.x + 8, y1);
          ctx.lineTo(layers.output.x - 8, y2);
          ctx.stroke();
        }
      }

      // Desenha neurônios
      Object.entries(layers).forEach(([_layerName, layer]) => {
        for (let i = 0; i < layer.count; i++) {
          const y = 30 + i * (140 / Math.max(1, layer.count - 1));
          const activation = layer.values[i] || 0;
          const intensity = Math.abs(activation);

          ctx.beginPath();
          ctx.arc(layer.x, y, 8, 0, Math.PI * 2);
          ctx.fillStyle =
            activation > 0
              ? `rgba(0, 255, 0, ${intensity})`
              : `rgba(255, 0, 0, ${intensity})`;
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = "#fff";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.fillText(activation.toFixed(2), layer.x, y + 2);
        }
      });
    }
  },

  updateHistory(
    agent: Agent,
    stepResult: StepResult,
    currentStep: number
  ): void {
    // Salva apenas a cada N steps para não sobrecarregar
    if (currentStep % this.sampleInterval === 0) {
      this.history.push({
        step: currentStep,
        memoryAngle: stepResult?.inputs[9] || 0,
        memoryDist: stepResult?.inputs[10] || 0,
        agentAngle: agent.a,
      });

      // Limita o tamanho do histórico
      if (this.history.length > this.maxHistoryPoints) {
        this.history.shift();
      }
    }
  },

  drawHistoryChart(): void {
    const canvas = this.elements?.debugElements.historyCanvas;
    if (!canvas || this.history.length < 2) return;

    const ctx = canvas.getContext("2d")!;
    const width = canvas.width;
    const height = canvas.height;
    const padding = 30;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = "#021024";
    ctx.fillRect(0, 0, width, height);

    // Encontra min/max para escala
    const steps = this.history.map((p) => p.step);
    const minStep = Math.min(...steps);
    const maxStep = Math.max(...steps);

    // Desenha eixos
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Labels dos eixos
    ctx.fillStyle = "#9aa6b2";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Step", width / 2, height - 5);

    ctx.save();
    ctx.translate(10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Value", 0, 0);
    ctx.restore();

    // Função para mapear valores para coordenadas
    const mapX = (step: number) =>
      padding + ((step - minStep) / (maxStep - minStep || 1)) * chartWidth;
    const mapY = (value: number) =>
      height - padding - ((value + 1) / 2) * chartHeight; // Normaliza de [-1,1] para [0,1]

    // Desenha linhas
    const drawLine = (
      data: number[],
      color: string,
      label: string,
      normalize: boolean = true
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      this.history.forEach((point, i) => {
        const x = mapX(point.step);
        let value = data[i];
        if (normalize) {
          // Normaliza ângulo para [-1, 1]
          value = Math.max(-1, Math.min(1, value / Math.PI));
        }
        const y = mapY(value);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Label
      ctx.fillStyle = color;
      ctx.font = "9px monospace";
      ctx.textAlign = "left";
    };

    // Desenha as três linhas
    drawLine(
      this.history.map((p) => p.agentAngle),
      "#58a6ff",
      "Agent Angle"
    );
    drawLine(
      this.history.map((p) => p.memoryAngle),
      "#f85149",
      "Memory Angle",
      false
    );
    drawLine(
      this.history.map((p) => p.memoryDist),
      "#3fb950",
      "Memory Dist",
      false
    );

    // Legenda
    const legendY = 15;
    ctx.font = "9px monospace";
    ctx.fillStyle = "#58a6ff";
    ctx.fillText("— Agent Angle", padding + 5, legendY);
    ctx.fillStyle = "#f85149";
    ctx.fillText("— Memory Angle", padding + 90, legendY);
    ctx.fillStyle = "#3fb950";
    ctx.fillText("— Memory Dist", padding + 185, legendY);
  },

  clearHistory(): void {
    this.history = [];
  },

  downloadDebugData(agent: Agent, stepResult: StepResult): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const generation = (window as unknown as WindowType).SIM?.generation || 0;

    const debugData = {
      timestamp: new Date().toISOString(),
      generation: generation,
      agent: {
        id: agent.id,
        position: { x: agent.x, y: agent.y },
        angle: agent.a,
        angleDegrees: (agent.a * 180) / Math.PI,
        velocity: agent.v,
        state: agent.state,
        carrying: agent.state === "CARRYING",
        fitness: agent.fitness,
        age: agent.age,
        deliveries: agent.deliveries,
        delivered: agent.delivered,
        collisions: agent.collisions,
        hasMinedBefore: agent.hasMinedBefore,
        hasLeftBase: agent.hasLeftBase,
        formaDeNascimento: agent.formaDeNascimento,
      },
      sensors:
        agent.sensorData?.map((sensor: SensorData, i: number) => ({
          id: i,
          angle: sensor.angle,
          range: sensor.range,
          proximity: sensor.proximity,
          stoneSignal: sensor.stoneSignal,
          baseSignal: sensor.baseSignal,
          obstacleDistance: sensor.obstacleDistance,
          endDistance: sensor.endDistance,
        })) || [],
      neuralNetwork: stepResult
        ? {
            inputs: stepResult.inputs.map((val: number, i: number) => {
              const labels = [
                "S0:Proximity",
                "S0:Stone",
                "S0:Base",
                "S1:Proximity",
                "S1:Stone",
                "S1:Base",
                "S2:Proximity",
                "S2:Stone",
                "S2:Base",
                "S3:Proximity",
                "S3:Stone",
                "S3:Base",
                "S4:Proximity",
                "S4:Stone",
                "S4:Base",
                "MemoryAngle",
                "MemoryDist",
                "State:SEEK",
                "State:MINING",
                "State:CARRYING",
              ];
              return {
                index: i,
                label: labels[i] || `Input${i}`,
                value: val,
              };
            }),
            outputs: stepResult.outputs.map((val: number, i: number) => ({
              index: i,
              label: ["Acceleration", "Rotation", "Mine"][i],
              value: val,
            })),
            hiddenLayerSize: agent.genome?.hidden || 0,
          }
        : null,
      genome: agent.genome
        ? {
            sensorAngles: Array.from(agent.genome.sensorAngles),
            sensorRange: agent.genome.sensorRange,
            inputs: agent.genome.inputs,
            hidden: agent.genome.hidden,
            outputs: agent.genome.outputs,
          }
        : null,
      history: {
        totalPoints: this.history.length,
        sampleInterval: this.sampleInterval,
        data: this.history.map((point) => ({
          step: point.step,
          memoryAngle: point.memoryAngle,
          memoryDist: point.memoryDist,
          agentAngle: point.agentAngle,
          agentAngleDegrees: (point.agentAngle * 180) / Math.PI,
        })),
      },
    };

    const json = JSON.stringify(debugData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debug-agent-gen${generation}-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

if (typeof window !== "undefined") {
  (window as unknown as WindowType).DOMManager = DOMManagerImpl;
}
