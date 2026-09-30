---
name: referencias-composicion
description: Busca referencias reales de composición y layout (qué secciones tiene una página, en qué orden, cómo se reparte el espacio y la jerarquía) en Dribbble, layers.to, 21st.dev, galerías de sitios y sitios reales, las captura con el Playwright MCP, se las muestra al usuario y propone 2 o 3 layouts antes de maquetar. Úsala siempre que el usuario pida referencias, inspiración, "cómo lo hacen otros", "busca en dribbble/layers/21st", opciones A/B/C de layout, o cuando haya que diseñar o maquetar una página, sección, pantalla o componente nuevo, o rediseñar la estructura de uno existente, aunque no mencione referencias. Solo composición: colores, tipografía y estilos los pone el sistema del proyecto.
---

# Referencias de composición

El estilo (color, tipografía, radios, sombras, íconos) ya lo decidió el diseñador del proyecto y vive en su código o en sus tokens. Esta skill investiga otra cosa: la **estructura**. Qué secciones tiene una página, en qué orden, qué domina arriba del pliegue, cómo se llega a la acción principal y qué pasa en móvil. Las referencias sirven para no inventar la composición desde cero; el estilo nunca se toma de ellas.

## Flujo

### 1. Definir qué se está armando

Antes de buscar, escribe en una línea qué es: tipo de página, audiencia, acción principal y qué contenido real hay para llenarla. Por ejemplo: "Índice histórico de eventos de un ministerio; público ciudadano y técnico; acción principal: encontrar un evento pasado y sus materiales; los eventos no tienen foto propia".

El contenido real importa porque condiciona qué referencias sirven: una grilla de tarjetas con foto no sirve si los elementos no tienen imagen. Si falta algo de esa línea y no se deduce del contexto, pregúntalo antes de seguir.

### 2. Buscar en todas las fuentes

El usuario no se cierra a ninguna fuente: recorre varias. Empieza por sus favoritas, que son las que mejor le funcionan, y complementa con galerías y sitios reales. El catálogo, con cómo se busca en cada sitio y sus mañas, está en `references/fuentes.md`; léelo antes de empezar.

- **Primero:** Dribbble y layers.to para la página completa; 21st.dev cuando haya secciones o bloques concretos que resolver (hero, filtros, tarjetas, pie).
- **Después:** una o dos galerías de sitios (Awwwards, Land-book, Godly, Lapa, Behance...) y dos o tres sitios reales del mismo rubro.

Por qué la mezcla: las vitrinas (Dribbble, layers, Behance) muestran conceptos pulidos con contenido ideal y dan ideas de composición rápido; los sitios reales muestran qué sobrevive con contenido de verdad, textos largos y muchos elementos. Una buena propuesta toma de los dos.

Busca en inglés, que trae muchos más resultados, y prueba dos o tres variantes del término ("event archive website", "past events page", "conference archive"). Apunta a 8 a 12 candidatas y quédate con las 5 a 8 mejores. Si un sitio bloquea, pide login o carga vacío, sáltalo y sigue.

### 3. Capturar con el Playwright MCP

- Guarda las capturas dentro de la carpeta que el MCP permite escribir (normalmente la del proyecto, por ejemplo `.playwright-mcp/`) y fuera de git: una carpeta ya ignorada o una entrada en `.git/info/exclude`. Son material de trabajo, no se commitean.
- En vitrinas (Dribbble, layers, Behance) abre la ficha de cada trabajo y captura la lámina grande, no la grilla de resultados. En la grilla solo se ven miniaturas.
- En sitios reales captura a 1440 de ancho a página completa y a 390 de ancho. Antes de la captura de página completa recorre la página hasta abajo: muchas imágenes cargan al hacer scroll y si no, salen en blanco. Usa `browser_snapshot` para confirmar el orden real de las secciones y los títulos en vez de adivinarlo por la imagen.
- Cierra banners de cookies o promociones si tapan contenido, sin aceptar nada más.
- El navegador del MCP es uno solo: no repartas capturas entre subagentes en paralelo, se pisan la página.

### 4. Mostrárselas al usuario

El usuario decide mirando, no leyendo. Envíale las mejores capturas (con `SendUserFile` si está disponible, si no indica la ruta) con una línea por cada una: de dónde es y qué patrón de composición aporta. Cita siempre la URL de origen.

Aclara cuando una referencia sea un concepto de vitrina y no un producto real, y cuando un patrón dependa de algo que el proyecto no tiene (fotos, cifras, volumen de contenido).

### 5. Analizar la composición

Por cada referencia elegida, anota en el chat o en un archivo de trabajo:

```markdown
## <Nombre>: <URL>
- **Secciones, en orden:** hero, buscador, destacados, ...
- **Grilla:** columnas, ancho del contenido, uso de barra lateral
- **Jerarquía:** qué domina arriba del pliegue y cómo se llega a la acción principal
- **Ritmo vertical:** densidad, secciones largas o cortas, separación
- **Navegación:** encabezado, menú, migas, pie
- **Móvil:** qué se reordena, colapsa u oculta
- **Qué tomar:** 1 a 3 patrones concretos para nuestro caso
- **Qué evitar:** 1 cosa que no sirve en nuestro contexto
```

No anotes colores, fuentes, sombras ni ilustraciones: no se van a usar, y anotarlos empuja a copiarlos.

### 6. Proponer layouts

Antes de escribir código, propone 2 o 3 layouts rotulados A, B y C:

- Secciones en orden, con una línea de propósito cada una.
- Qué referencia inspira cada decisión.
- Comportamiento en móvil.
- Un esquema ASCII simple del escritorio.

Recomienda uno y di por qué. Si las opciones van en una imagen o esquema rotulado, lista las opciones en ese mismo orden de letras aunque la recomendada no sea la primera. Espera a que el usuario elija o combine antes de implementar.

### 7. Implementar y verificar

- Maqueta solo con los tokens, clases y componentes que ya existen en el proyecto.
- Al terminar, captura tu página a 1440 y 390 y compárala con la propuesta elegida: orden de secciones, jerarquía y comportamiento en móvil.
- Si algo necesita un estilo que el sistema del proyecto no tiene, anótalo como pendiente en vez de inventarlo.

## Reglas

- No copies textos, imágenes ni código de las referencias: se toma el patrón, no la pieza.
- No introduzcas colores, fuentes ni efectos que no estén en el sistema del proyecto, aunque la referencia sea preciosa. El diseñador ya decidió el lenguaje visual y la referencia solo aporta estructura.
- Cierra el informe con la lista de fuentes consultadas, con sus URLs.
