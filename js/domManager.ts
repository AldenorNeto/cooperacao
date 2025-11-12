interface SimpleDOMElements {
  canvas: HTMLCanvasElement;
  buttons: {
    start: HTMLElement;
    reset: HTMLElement;
    debug: HTMLElement;
  };
  rangeControls: {
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
  };
}

const DOMManagerImpl = {
  elements: null as SimpleDOMElements | null,

  init(): SimpleDOMElements {
    this.elements = {
      canvas: document.getElementById("c") as HTMLCanvasElement,
      buttons: {
        start: document.getElementById("btnStart")!,
        reset: document.getElementById("btnReset")!,
        debug: document.getElementById("btnDebug")!,
      },
      rangeControls: {
        genTimeRange: document.getElementById("genTimeRange") as HTMLInputElement,
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
        neuralCanvas: document.getElementById("neuralCanvas") as HTMLCanvasElement,
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
    
    e.rangeControls.genTimeRange.addEventListener("input", (event) => {
      const value = (event.target as HTMLInputElement).value;
      e.rangeControls.genTimeValue.textContent = value;
      if ((window as any).SIM) {
        (window as any).SIM.genSeconds = parseInt(value);
        (window as any).SIM.stepsPerGen = parseInt(value) * 60;
      }
    });

    e.rangeControls.stepsRange.addEventListener("input", (event) => {
      const value = (event.target as HTMLInputElement).value;
      e.rangeControls.stepsValue.textContent = value;
      if ((window as any).SIM) {
        (window as any).SIM.stepsPerGen = parseInt(value);
      }
    });
  },

  updateUI(sim: any): void {
    if (this.elements?.stonesDelivered) {
      this.elements.stonesDelivered.textContent = String(sim.world?.stonesDelivered ?? 0);
    }
    
    // Sempre mostra debug panel
    this.elements!.debugPanel.style.display = 'block';
    
    const targetAgent = sim.debugMode ? sim.population[0] : sim.population.find((a: any) => a.formaDeNascimento === 'elite') || sim.population[0];
    if (targetAgent) {
      this.updateDebugInfo(targetAgent, sim.lastStepResult);
      // Armazena agente para linha de rastreamento
      (window as any).SIM.trackedAgent = targetAgent;
    }
  },

  updateDebugInfo(agent: any, stepResult: any): void {
    const e = this.elements!.debugElements;
    
    e.agentPos.textContent = `${agent.x.toFixed(1)}, ${agent.y.toFixed(1)}`;
    e.agentAngle.textContent = `${(agent.a * 180 / Math.PI).toFixed(1)}°`;
    e.agentVel.textContent = agent.v.toFixed(3);
    e.agentState.textContent = agent.state;
    e.agentCarry.textContent = agent.state === 'CARRYING' ? 'true' : 'false';
    e.agentFitness.textContent = agent.fitness.toFixed(2);
    
    if (agent.sensorData) {
      e.sensorValues.innerHTML = '';
      agent.sensorData.forEach((sensor: any, i: number) => {
        const div = document.createElement('div');
        div.className = `sensor-item ${sensor.proximity > 0.5 ? 'sensor-active' : ''}`;
        div.innerHTML = `<span>S${i}:</span><span>${sensor.proximity.toFixed(3)}</span>`;
        e.sensorValues.appendChild(div);
      });
    }
    
    if (stepResult) {
      e.networkInputs.innerHTML = '<strong>Inputs:</strong><br>';
      stepResult.inputs.forEach((val: number, i: number) => {
        const div = document.createElement('div');
        div.className = `network-item ${Math.abs(val) > 0.5 ? 'network-high' : ''}`;
        div.innerHTML = `<span>I${i}:</span><span>${val.toFixed(3)}</span>`;
        e.networkInputs.appendChild(div);
      });
      
      e.networkOutputs.innerHTML = '<strong>Outputs:</strong><br>';
      stepResult.outputs.forEach((val: number, i: number) => {
        const div = document.createElement('div');
        div.className = `network-item ${Math.abs(val) > 0.5 ? 'network-high' : ''}`;
        const labels = ['Accel', 'Rotate', 'Mine'];
        div.innerHTML = `<span>${labels[i]}:</span><span>${val.toFixed(3)}</span>`;
        e.networkOutputs.appendChild(div);
      });
      
      const ctx = e.neuralCanvas.getContext('2d')!;
      ctx.clearRect(0, 0, e.neuralCanvas.width, e.neuralCanvas.height);
      
      const layers = {
        input: { x: 30, count: stepResult.inputs.length, values: stepResult.inputs },
        hidden: { x: 150, count: agent.genome.hidden, values: [] as number[] },
        output: { x: 270, count: stepResult.outputs.length, values: stepResult.outputs }
      };
      
      for (let h = 0; h < agent.genome.hidden; h++) {
        let sum = agent.genome.hiddenBiases[h];
        for (let i = 0; i < stepResult.inputs.length; i++) {
          sum += stepResult.inputs[i] * agent.genome.hiddenWeights[h * stepResult.inputs.length + i];
        }
        layers.hidden.values[h] = Math.tanh(sum);
      }
      
      // Desenha conexões Input -> Hidden
      for (let i = 0; i < layers.input.count; i++) {
        for (let h = 0; h < layers.hidden.count; h++) {
          const weight = agent.genome.hiddenWeights[h * layers.input.count + i];
          const alpha = Math.min(0.8, Math.abs(weight));
          ctx.strokeStyle = weight > 0 ? `rgba(0, 255, 0, ${alpha})` : `rgba(255, 0, 0, ${alpha})`;
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
          const weight = agent.genome.outputWeights[o * layers.hidden.count + h];
          const alpha = Math.min(0.8, Math.abs(weight));
          ctx.strokeStyle = weight > 0 ? `rgba(0, 255, 0, ${alpha})` : `rgba(255, 0, 0, ${alpha})`;
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
      Object.entries(layers).forEach(([layerName, layer]) => {
        for (let i = 0; i < layer.count; i++) {
          const y = 30 + i * (140 / Math.max(1, layer.count - 1));
          const activation = layer.values[i] || 0;
          const intensity = Math.abs(activation);
          
          ctx.beginPath();
          ctx.arc(layer.x, y, 8, 0, Math.PI * 2);
          ctx.fillStyle = activation > 0 ? `rgba(0, 255, 0, ${intensity})` : `rgba(255, 0, 0, ${intensity})`;
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.stroke();
          
          ctx.fillStyle = '#fff';
          ctx.font = '8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(activation.toFixed(2), layer.x, y + 2);
        }
      });
    }
  },
};

if (typeof window !== "undefined") {
  (window as any).DOMManager = DOMManagerImpl;
}