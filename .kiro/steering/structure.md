# Project Structure

## Directory Organization

```
cooperacao-agentes/
├── js/                    # TypeScript source files
│   ├── script.ts          # Main simulation loop and core logic
│   ├── utils.ts           # Geometric utility functions (centralized)
│   ├── sensorSystem.ts    # Sensor calculation and rendering
│   ├── memorySystem.ts    # Agent memory and learning bonuses
│   ├── geneticSystem.ts   # Evolution and population management
│   ├── rewardSystem.ts    # Fitness calculation and rewards
│   ├── mapGenerator.ts    # World generation (base, stones, obstacles)
│   ├── renderer.ts        # Canvas rendering system
│   ├── domManager.ts      # UI updates and DOM manipulation
│   ├── chartManager.ts    # Fitness chart visualization
│   └── debugSystem.ts     # Debug mode and agent inspection
├── css/
│   └── styles.css         # Application styling
├── dist/                  # Compiled JavaScript output
├── .kiro/
│   └── steering/          # AI assistant guidance documents
├── index.html             # Main HTML entry point
├── types.d.ts             # TypeScript type definitions
├── tsconfig.json          # TypeScript configuration
├── server.ts              # Development server
└── package.json           # Dependencies and scripts
```

## Architecture Patterns

### Module System

- **Global Namespace Pattern**: Systems expose themselves via `window` object
- Each system file assigns to `window.SystemName` for cross-module access
- Example: `window.GeneticSystem = GeneticSystemImpl`
- Script loading order matters (see `index.html`)

### Load Order (Critical)

1. **Utilities first**: `utils.js`, `sensorSystem.js`, `memorySystem.js`
2. **Core systems**: `rewardSystem.js`, `geneticSystem.js`, `mapGenerator.js`, `renderer.js`
3. **Managers**: `domManager.js`, `chartManager.js`, `debugSystem.js`
4. **Main script last**: `script.js` (uses all above systems)

### System Responsibilities

#### Core Simulation (`script.ts`)

- Main simulation loop
- Agent and Genome classes
- World state management
- Physics and collision handling
- Generation lifecycle

#### Utility Systems

- **GeometryUtils**: Shared math functions (clamp, distance, ray intersection)
- **SensorSystem**: Sensor data calculation and visualization
- **MemorySystem**: Agent memory tracking and bonuses

#### Evolution Systems

- **GeneticSystem**: Population evolution, crossover, mutation, selection
- **RewardSystem**: Fitness calculation, multi-objective optimization

#### World Systems

- **MapGenerator**: Procedural generation of base, stones, obstacles
- **Renderer**: All canvas drawing operations

#### UI Systems

- **DOMManager**: UI updates, input handling, canvas resizing
- **ChartManager**: Fitness history visualization
- **DebugSystem**: Single-agent analysis and network visualization

## Code Conventions

### Configuration

- All magic numbers centralized in `CONFIG` object in `script.ts`
- Organized by category: POPULATION, GENETIC, SIMULATION, AGENT, PHYSICS, GENOME, ACTIONS
- Modify CONFIG instead of hardcoding values

### Naming Conventions

- **Classes**: PascalCase (`Agent`, `Genome`, `Simulation`)
- **Interfaces**: PascalCase with `Interface` suffix (`RewardSystemInterface`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_SPEED`, `SENSOR_COUNT`)
- **Functions**: camelCase (`calculateFitness`, `stepAgent`)
- **Private methods**: Prefix with underscore (`_updateAgentPhysics`)

### Type Safety

- Use TypeScript interfaces defined in `types.d.ts`
- Avoid `any` type (ESLint warns)
- Prefer `const` over `let` (ESLint enforces)
- Unused variables prefixed with `_` are allowed

### Code Organization

- **No duplication**: Refactored to eliminate duplicate functions
- **Single responsibility**: Each system handles one concern
- **Centralized utilities**: Shared functions in `utils.ts`
- **Type definitions**: All interfaces in `types.d.ts`

## Key Design Decisions

### Why Global Namespace?

- Simplifies module communication without bundler
- Browser-native ES modules with explicit load order
- TypeScript provides type safety via `types.d.ts`

### Why Separate Systems?

- Reduces main file from ~1400 to ~1000 lines
- Eliminates ~480 lines of duplicated code
- Each system can be modified independently
- Easier testing and debugging

### Why TypeScript?

- Type safety catches errors at compile time
- Better IDE support and autocomplete
- Self-documenting code via interfaces
- Gradual adoption (JavaScript still works)

## File Modification Guidelines

### When modifying core logic:

- Update `script.ts` for simulation/physics changes
- Update `types.d.ts` if adding/changing interfaces
- Run `npm run type-check` before committing

### When adding features:

- Consider creating new system file if substantial
- Update `index.html` script loading order
- Add types to `types.d.ts`
- Update CONFIG if adding parameters

### When fixing bugs:

- Check for similar code in other files (avoid duplication)
- Use utility functions from `utils.ts` or `sensorSystem.ts`
- Verify with `npm run lint` and `npm run type-check`
