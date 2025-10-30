# Cooperação de Agentes - Simulação com Algoritmos Genéticos

Simulação de agentes cooperativos usando algoritmos genéticos e redes neurais.

## 🚀 Como Executar

### Pré-requisitos
- Node.js (versão 16+)
- npm

### Instalação e Execução
```bash
# Instalar dependências
npm install

# Executar em modo desenvolvimento (TypeScript)
npm run dev

# Ou compilar e executar
npm run build
npm start
```

Acesse: http://localhost:3000

## 🛠️ Scripts Disponíveis

- `npm run dev` - Servidor de desenvolvimento com TypeScript
- `npm run build` - Compila TypeScript para JavaScript
- `npm start` - Executa versão compilada
- `npm run type-check` - Verifica tipos TypeScript
- `npm run type-check:watch` - Verificação contínua de tipos

## 📁 Estrutura do Projeto

```
cooperacao/
├── js/
│   ├── utils.ts          # Funções geométricas
│   ├── sensorSystem.ts   # Sistema de sensores
│   ├── script.js         # Lógica principal
│   ├── renderer.js       # Sistema de renderização
│   ├── geneticSystem.js  # Algoritmo genético
│   ├── rewardSystem.js   # Sistema de recompensas
│   └── ...
├── css/
│   └── styles.css
├── types.d.ts           # Definições TypeScript
├── tsconfig.json        # Configuração TypeScript
├── server.ts            # Servidor HTTP
└── index.html
```

## 🎯 Funcionalidades

- **Algoritmos Genéticos**: Evolução de comportamentos
- **Redes Neurais**: Controle inteligente dos agentes
- **Sistema de Sensores**: Detecção de ambiente
- **Cooperação**: Agentes trabalham juntos
- **Visualização**: Interface gráfica em tempo real
- **TypeScript**: Tipagem estática para melhor desenvolvimento

## 🔧 Configuração

Ajuste parâmetros em `CONFIG` no arquivo principal:
- População, mutação, fitness
- Física, sensores, comportamentos
- Performance e visualização