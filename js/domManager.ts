interface SimpleDOMElements {
  canvas: HTMLCanvasElement;
  buttons: {
    start: HTMLElement;
    reset: HTMLElement;
  };
  rangeControls: {
    genTimeRange: HTMLInputElement;
    genTimeValue: HTMLElement;
    stepsRange: HTMLInputElement;
    stepsValue: HTMLElement;
  };
  stonesDelivered: HTMLElement;
}

const DOMManagerImpl = {
  elements: null as SimpleDOMElements | null,

  init(): SimpleDOMElements {
    this.elements = {
      canvas: document.getElementById("c") as HTMLCanvasElement,
      buttons: {
        start: document.getElementById("btnStart")!,
        reset: document.getElementById("btnReset")!,
      },
      rangeControls: {
        genTimeRange: document.getElementById("genTimeRange") as HTMLInputElement,
        genTimeValue: document.getElementById("genTimeValue")!,
        stepsRange: document.getElementById("stepsRange") as HTMLInputElement,
        stepsValue: document.getElementById("stepsValue")!,
      },
      stonesDelivered: document.getElementById("stonesDelivered")!,
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
  },
};

if (typeof window !== "undefined") {
  (window as any).DOMManager = DOMManagerImpl;
}