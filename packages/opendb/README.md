# @framerate/opendb

Este paquete proporciona un cliente para interactuar con el [BuildCores OpenDB](https://github.com/buildcores/buildcores-open-db).

## Uso

```typescript
import { OpenDBClient } from "@framerate/opendb";

const client = new OpenDBClient();

// Sincronizar el repositorio (clonar o actualizar)
await client.sync();

// Obtener categorías disponibles
const categories = client.getCategories();

// Obtener elementos de una categoría
const cpus = client.getItems("CPU");
```

## Configuración

Puedes configurar el cliente pasando un objeto al constructor:

```typescript
const client = new OpenDBClient({
  repoUrl: "https://github.com/buildcores/buildcores-open-db.git",
  localPath: "./custom/path/to/opendb",
});
```
