# @framerate/config — Biome shared configuration

🔧 Este paquete exporta configuraciones compartidas para Biome.

Usos recomendados:

- En el `root` del repo: extiende desde el paquete exportado para aplicar las reglas comunes en todo el monorepo:

```json
{
  "extends": ["@framerate/config/biome"]
}
```

- En paquetes individuales que deban seguir la configuración raíz (por ejemplo `apps/*` o `packages/*`), usar la microsintaxis `extends: "//"` en `biome.json` del paquete:

```json
{
  "root": false,
  "extends": "//"
}
```

- Si un paquete necesita reglas distintas (por ejemplo, generación de código, equipos con normas diferentes), omita `extends` y defina su propio `biome.json`.

Notas:
- La configuración canónica compartida está en `packages/config/biome.json` y se exporta como `@framerate/config/biome`.
- Actualice `packages/config/package.json` si necesita exponer otras variantes.

Sugerencias para seguir:
- Eliminar o marcar `biome.root.jsonc` como deprecado para evitar confusión con la configuración raíz (`biome.json`).
- Agregar checks en CI (ya existe `bun run biome:check` y `bun run biome` en scripts).
