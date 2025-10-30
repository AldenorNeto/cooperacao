const ChampionViewerImpl = {
  // Histórico dos últimos campeões
  history: [],
  maxHistory: 3,
  storageKey: "championHistory",

  /**
   * Carrega histórico do localStorage
   */
  loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.history = JSON.parse(stored);
        this.updateDisplay();
      }
    } catch (e) {
      console.warn("Erro ao carregar histórico de campeões:", e);
      this.history = [];
    }
  },

  /**
   * Salva histórico no localStorage
   */
  saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.history));
    } catch (e) {
      console.warn("Erro ao salvar histórico de campeões:", e);
    }
  },

  /**
   * Adiciona novo campeão ao histórico
   */
  addChampion(
    championJson: string,
    generation: number,
    fitness: number,
    delivered: number
  ): void {
    const championData = {
      generation,
      fitness,
      delivered,
      genome: JSON.parse(championJson),
      timestamp: Date.now(),
    };

    this.history.unshift(championData);
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }

    this.saveToStorage();
    this.updateDisplay();
  },

  /**
   * Atualiza a exibição na UI
   */
  updateDisplay(): void {
    const container = document.getElementById("championHistory");
    if (!container) return;

    container.innerHTML = this.generateHistoryHTML();
  },

  /**
   * Gera HTML formatado do histórico
   */
  generateHistoryHTML(): string {
    if (this.history.length === 0) {
      return '<div class="champion-empty">Nenhum campeão ainda...</div>';
    }

    let html = "";

    for (let i = 0; i < this.history.length; i++) {
      const champion = this.history[i];
      const isLatest = i === 0;
      const previousChampion =
        i < this.history.length - 1 ? this.history[i + 1] : null;

      html += this.generateChampionCard(
        champion,
        isLatest,
        previousChampion,
        i
      );
    }

    return html;
  },

  /**
   * Gera card de um campeão
   */
  generateChampionCard(
    champion: any,
    isLatest: boolean,
    previousChampion: any,
    index: number
  ): string {
    const title = isLatest ? "Atual" : `Gen -${index}`;
    const changes = previousChampion
      ? this.compareGenomes(champion.genome, previousChampion.genome)
      : null;

    return `
      <div class="champion-card ${isLatest ? "current" : "previous"}">
        <div class="champion-header">
          <h4>${title} (Gen ${champion.generation})</h4>
          <div class="champion-stats">
            <span class="fitness">Fit: ${champion.fitness}</span>
            <span class="delivered">Del: ${champion.delivered}</span>
          </div>
        </div>
        
        <div class="champion-genome">
          ${this.formatGenome(champion.genome, changes)}
        </div>
        
        ${
          changes
            ? `<div class="champion-changes">
          <strong>Mudanças:</strong> ${changes.totalChanges} alterações
          <div class="change-summary">${this.formatChangeSummary(changes)}</div>
        </div>`
            : ""
        }
      </div>
    `;
  },

  /**
   * Formata genoma com destaque para mudanças
   */
  formatGenome(genome: any, changes: any): string {
    const sections = [
      { name: "Sensores", data: genome.sensorAngles, key: "sensorAngles" },
      { name: "Alcance", data: [genome.sensorRange], key: "sensorRange" },
      { name: "Pesos", data: genome.weights.slice(0, 20), key: "weights" }, // Primeiros 20 pesos
      { name: "Biases", data: genome.biases, key: "biases" },
    ];

    return sections
      .map((section) => {
        const hasChanges = changes && changes.sections[section.key];
        const changeCount = hasChanges
          ? changes.sections[section.key].length
          : 0;

        return `
        <div class="genome-section ${hasChanges ? "has-changes" : ""}">
          <div class="section-header">
            <span class="section-name">${section.name}</span>
            ${
              changeCount > 0
                ? `<span class="change-count">${changeCount} mudanças</span>`
                : ""
            }
          </div>
          <div class="section-values">
            ${this.formatValues(
              section.data,
              hasChanges ? changes.sections[section.key] : []
            )}
          </div>
        </div>
      `;
      })
      .join("");
  },

  /**
   * Formata valores com destaque para mudanças
   */
  formatValues(values: any[], changedIndices: number[]): string {
    return values
      .map((value, index) => {
        const isChanged = changedIndices.includes(index);
        const formattedValue =
          typeof value === "number" ? value.toFixed(3) : value;

        return `<span class="value ${isChanged ? "changed" : ""}" title="${
          isChanged ? "Alterado" : ""
        }">${formattedValue}</span>`;
      })
      .join(" ");
  },

  /**
   * Compara dois genomas e retorna diferenças
   */
  compareGenomes(current: any, previous: any): any {
    const changes = {
      sections: {
        sensorAngles: [],
        sensorRange: [],
        weights: [],
        biases: [],
      },
      totalChanges: 0,
    };

    // Compara sensor angles
    for (let i = 0; i < current.sensorAngles.length; i++) {
      if (
        Math.abs(current.sensorAngles[i] - previous.sensorAngles[i]) > 0.001
      ) {
        changes.sections.sensorAngles.push(i);
      }
    }

    // Compara sensor range
    if (Math.abs(current.sensorRange - previous.sensorRange) > 0.1) {
      changes.sections.sensorRange.push(0);
    }

    // Compara primeiros 20 pesos (para performance)
    for (let i = 0; i < Math.min(20, current.weights.length); i++) {
      if (Math.abs(current.weights[i] - previous.weights[i]) > 0.001) {
        changes.sections.weights.push(i);
      }
    }

    // Compara biases
    for (let i = 0; i < current.biases.length; i++) {
      if (Math.abs(current.biases[i] - previous.biases[i]) > 0.001) {
        changes.sections.biases.push(i);
      }
    }

    // Calcula total de mudanças
    changes.totalChanges = Object.values(changes.sections).reduce(
      (sum, arr) => sum + arr.length,
      0
    );

    return changes;
  },

  /**
   * Formata resumo das mudanças
   */
  formatChangeSummary(changes: any): string {
    const summaries = [];

    if (changes.sections.sensorAngles.length > 0) {
      summaries.push(`${changes.sections.sensorAngles.length} sensores`);
    }
    if (changes.sections.sensorRange.length > 0) {
      summaries.push("alcance");
    }
    if (changes.sections.weights.length > 0) {
      summaries.push(`${changes.sections.weights.length} pesos`);
    }
    if (changes.sections.biases.length > 0) {
      summaries.push(`${changes.sections.biases.length} biases`);
    }

    return summaries.join(", ") || "Nenhuma mudança detectada";
  },

  /**
   * Limpa histórico
   */
  clearHistory(): void {
    this.history = [];
    localStorage.removeItem(this.storageKey);
    this.updateDisplay();
  },
};

// Exporta para uso global
if (typeof window !== "undefined") {
  (window as any).ChampionViewer = ChampionViewerImpl;
}
