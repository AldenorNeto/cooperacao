# Technology Stack

## Build System & Tools

### TypeScript Configuration

- **Target**: ES2020
- **Module System**: ES2020 modules
- **Strict Mode**: Enabled with relaxed null checks
- **Output**: Compiled to `dist/` directory
- TypeScript files in `js/` compile to `dist/js/`

### Development Tools

- **Linter**: ESLint with TypeScript plugin
- **Formatter**: Prettier (2 spaces, semicolons, double quotes)
- **Type Checking**: Available via `tsc --noEmit`

## Tech Stack

### Frontend

- **Vanilla TypeScript/JavaScript** - No frameworks
- **Canvas API** - All rendering via 2D context
- **HTML5** - Single page application
- **CSS3** - Custom styling in `css/styles.css`

### Backend

- **Node.js HTTP Server** - Simple static file server (`server.ts`)
- Serves compiled JS from `dist/` directory
- Redirects `/js/*.js` requests to `/dist/js/*.js`

### Core Libraries

- **No external dependencies** - Pure TypeScript/JavaScript implementation
- Custom implementations for:
  - Genetic algorithms
  - Neural networks (feedforward)
  - Sensor systems
  - Rendering engine

## Common Commands

### Development

```bash
npm install              # Install dependencies
npm run dev             # Build and start server (http://localhost:3000)
npm start               # Same as dev
```

### Building

```bash
npm run build           # Compile TypeScript to JavaScript
```

### Code Quality

```bash
npm run type-check      # Check types once
npm run type-check:watch # Continuous type checking
npm run lint            # Lint TypeScript files
npm run lint:fix        # Auto-fix linting issues
npm run format          # Format code with Prettier
```

### Testing

- No test framework currently configured
- Manual testing via browser at `http://localhost:3000`

## Browser Requirements

- Modern browser with Canvas API support
- ES2020 JavaScript support
- LocalStorage for simulation state persistence
