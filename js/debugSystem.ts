const DebugSystemImpl: DebugSystemInterface = {
  isActive: false,

  toggle(sim: Simulation | SimulationView): void {
    this.isActive = !this.isActive;
    sim.debugMode = this.isActive;

    const debugPanel = document.getElementById("debugPanel");
    const debugBtn = document.getElementById("btnDebug");

    if (this.isActive) {
      debugBtn?.classList.add("active");
      if (debugPanel) debugPanel.style.display = "block";
      // Reduz população para apenas 1 agente
      if (sim.population.length > 1) {
        sim.population = [sim.population[0]];
      }
    } else {
      debugBtn?.classList.remove("active");
      if (debugPanel) debugPanel.style.display = "none";
      sim.buildPopulation(); // Reconstrói com população normal
    }
  },

  reset(): void {
    this.isActive = false;
    const debugPanel = document.getElementById("debugPanel");
    const debugBtn = document.getElementById("btnDebug");
    if (debugPanel) debugPanel.style.display = "none";
    if (debugBtn) debugBtn.classList.remove("active");
  },

  updateAgentInfo(agent: Agent): void {
    if (!this.isActive) return;

    const elements = {
      agentPos: document.getElementById("agentPos"),
      agentAngle: document.getElementById("agentAngle"),
      agentVel: document.getElementById("agentVel"),
      agentState: document.getElementById("agentState"),
      agentCarry: document.getElementById("agentCarry"),
      agentFitness: document.getElementById("agentFitness"),
    };

    if (elements.agentPos)
      elements.agentPos.textContent = `${agent.x.toFixed(1)}, ${agent.y.toFixed(1)}`;
    if (elements.agentAngle)
      elements.agentAngle.textContent = `${((agent.a * 180) / Math.PI).toFixed(1)}°`;
    if (elements.agentVel) elements.agentVel.textContent = agent.v.toFixed(3);
    if (elements.agentState) elements.agentState.textContent = agent.state;
    if (elements.agentCarry)
      elements.agentCarry.textContent =
        agent.state === "CARRYING" ? "true" : "false";
    if (elements.agentFitness)
      elements.agentFitness.textContent = agent.fitness.toFixed(2);
  },

  updateSensorInfo(sensorData: SensorData[]): void {
    if (!this.isActive) return;

    const container = document.getElementById("sensorValues");
    if (!container) return;

    container.innerHTML = "";
    sensorData.forEach((sensor, i) => {
      const div = document.createElement("div");
      div.className = `sensor-item ${sensor.proximity > 0.5 ? "sensor-active" : ""}`;
      div.innerHTML = `<span>S${i}:</span><span>${sensor.proximity.toFixed(3)}</span>`;
      container.appendChild(div);
    });
  },

  updateNetworkInfo(inputs: number[], outputs: number[]): void {
    if (!this.isActive) return;

    const inputContainer = document.getElementById("networkInputs");
    const outputContainer = document.getElementById("networkOutputs");

    if (inputContainer) {
      inputContainer.innerHTML = "<strong>Inputs:</strong><br>";
      inputs.forEach((val, i) => {
        const div = document.createElement("div");
        div.className = `network-item ${Math.abs(val) > 0.5 ? "network-high" : ""}`;
        div.innerHTML = `<span>I${i}:</span><span>${val.toFixed(3)}</span>`;
        inputContainer.appendChild(div);
      });
    }

    if (outputContainer) {
      outputContainer.innerHTML = "<strong>Outputs:</strong><br>";
      outputs.forEach((val, i) => {
        const div = document.createElement("div");
        div.className = `network-item ${Math.abs(val) > 0.5 ? "network-high" : ""}`;
        const labels = ["Accel", "Rotate", "Mine"];
        div.innerHTML = `<span>${labels[i]}:</span><span>${val.toFixed(3)}</span>`;
        outputContainer.appendChild(div);
      });
    }
  },

  drawNeuralNetwork(genome: Genome, inputs: number[], outputs: number[]): void {
    if (!this.isActive) return;

    const canvas = document.getElementById("neuralCanvas") as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const layers = {
      input: { x: 30, count: inputs.length, values: inputs },
      hidden: { x: 150, count: genome.hidden, values: [] as number[] },
      output: { x: 270, count: outputs.length, values: outputs },
    };

    // Calcula valores da camada oculta
    for (let h = 0; h < genome.hidden; h++) {
      let sum = genome.hiddenBiases[h];
      for (let i = 0; i < inputs.length; i++) {
        sum += inputs[i] * genome.hiddenWeights[h * inputs.length + i];
      }
      layers.hidden.values[h] = Math.tanh(sum);
    }

    // Desenha conexões Input -> Hidden
    for (let i = 0; i < layers.input.count; i++) {
      for (let h = 0; h < layers.hidden.count; h++) {
        const weight = genome.hiddenWeights[h * layers.input.count + i];
        const alpha = Math.min(1, Math.abs(weight));
        ctx.strokeStyle =
          weight > 0
            ? `rgba(0, 255, 0, ${alpha * 0.5})`
            : `rgba(255, 0, 0, ${alpha * 0.5})`;

        const y1 = 30 + i * (140 / Math.max(1, layers.input.count - 1));
        const y2 = 30 + h * (140 / Math.max(1, layers.hidden.count - 1));

        ctx.beginPath();
        ctx.moveTo(layers.input.x + 10, y1);
        ctx.lineTo(layers.hidden.x - 10, y2);
        ctx.stroke();
      }
    }

    // Desenha conexões Hidden -> Output
    for (let h = 0; h < layers.hidden.count; h++) {
      for (let o = 0; o < layers.output.count; o++) {
        const weight = genome.outputWeights[o * layers.hidden.count + h];
        const alpha = Math.min(1, Math.abs(weight));
        ctx.strokeStyle =
          weight > 0
            ? `rgba(0, 255, 0, ${alpha * 0.5})`
            : `rgba(255, 0, 0, ${alpha * 0.5})`;

        const y1 = 30 + h * (140 / Math.max(1, layers.hidden.count - 1));
        const y2 = 30 + o * (140 / Math.max(1, layers.output.count - 1));

        ctx.beginPath();
        ctx.moveTo(layers.hidden.x + 10, y1);
        ctx.lineTo(layers.output.x - 10, y2);
        ctx.stroke();
      }
    }

    // Desenha neurônios
    Object.entries(layers).forEach(([layerName, layer]) => {
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

        // Valor do neurônio
        ctx.fillStyle = "#fff";
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(activation.toFixed(2), layer.x, y + 2);
      }
    });
  },

  update(agent: Agent, stepResult: StepResult): void {
    if (!this.isActive || !agent) return;

    this.updateAgentInfo(agent);

    if (agent.sensorData) {
      this.updateSensorInfo(agent.sensorData);
    }

    if (stepResult) {
      this.updateNetworkInfo(stepResult.inputs, stepResult.outputs);
      this.drawNeuralNetwork(
        agent.genome,
        stepResult.inputs,
        stepResult.outputs
      );
    }
  },
};

if (typeof window !== "undefined") {
  (window as unknown as WindowType).DebugSystem = DebugSystemImpl;
}
