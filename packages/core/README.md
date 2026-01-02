# @framerate/core

Paquete minimalista con la lógica compartida para el CompatibilityEngine y reglas de validación de builds de PC.

## Instalación

- Ejecutar en la raíz: `bun install`

## Objetivos (breve)

- Proveer un motor de compatibilidad (socket, wattage, memory, clearances)
- Ser stateless y apto para edge/Workers
- Ser extensible: nuevas reglas implementan `BuildRule` y se agregan a `ALL_RULES`
- Mantener tests mínimos y tipos para integración con el monorepo

## Uso rápido

```ts
import { CompatibilityEngine } from "@framerate/core";
const engine = new CompatibilityEngine();
const result = engine.isCompatible(specA, specB);
```

## Comandos

- Lint: `bun run -w @framerate/core lint`
- Test: `bun run -w @framerate/core test`

License: MIT