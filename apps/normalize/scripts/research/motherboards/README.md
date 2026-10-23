# Referencia de placas madre (#188, #222)

Pipeline del 22-10-2026, método de #208. Todo trabaja en `apps/normalize/.wrangler/dataset/motherboards/` (ignorado
por git): `catalog-boards.json` (placas del catálogo, consulta en #188), `cdx-asus.json` y `cdx-msi.json` (fichas
archivadas en Wayback), `plan-full.json` (una URL por placa), `pages-full/` (texto de cada ficha), `extracted/`
(JSON por lote) y `rows-motherboard.json` (entrada de `part-reference.ts build motherboard`).

```bash
cd apps/normalize && D=.wrangler/dataset/motherboards
bun scripts/research/motherboards/match2.ts $D          # empareja catálogo con URLs (ASUS, MSI; Gigabyte adivina)
bun scripts/research/motherboards/guess2.ts $D          # segunda pasada: ROG directo, ASUS por odinapi, MSI por CDX
bun scripts/research/motherboards/verify-gigabyte.ts $D # busca cada URL de Gigabyte en Wayback (en serie: limita el paralelo)
bun scripts/research/motherboards/fetch-all.ts $D       # baja las fichas (ASUS por odinapi, ROG directo, el resto Wayback)
# extracción: subagentes Haiku por lote (batches/*.txt → extracted/*.json) o `extract.ts $D <lote.txt>` con ANTHROPIC_API_KEY
bun scripts/research/motherboards/merge.ts $D           # → rows-motherboard.json
bun scripts/part-reference.ts build motherboard $D/rows-motherboard.json && bun scripts/part-reference.ts sql > /tmp/part-reference.sql
```

Fuentes: ASUS `odinapi.asus.com/recent-data/apiv2/PDTechSpec?ProductWebPath=<slug>` (JSON, sin anti-bot); ROG
`rog.asus.com/motherboards/<serie>/<slug>/spec/` (directo); MSI y Gigabyte sólo por Wayback (`id_`, última captura
con 200 y más de 4 KB; descomprimir si llega gzip); ASRock bloqueado por Incapsula y sin archivo.
