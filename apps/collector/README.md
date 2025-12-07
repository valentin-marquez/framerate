# Framerate Collector Service

![Hono](https://img.shields.io/badge/Hono-API-E36002?style=flat&logo=hono)
![Bun](https://img.shields.io/badge/Bun-Runtime-000000?style=flat&logo=bun)
![Puppeteer](https://img.shields.io/badge/Puppeteer-Scraping-40B5A4?style=flat&logo=puppeteer)

Servicio encargado de la **ingesta, normalización y descubrimiento** de productos de hardware desde diversas tiendas chilenas. Este servicio es el núcleo de la entrada de datos para Framerate.cl.

## Diferencias con el Tracker

| Característica | Collector (`apps/collector`) | Tracker (`apps/tracker`) |
|----------------|--------------------------|--------------------------|
| **Objetivo** | Descubrir nuevos productos | Actualizar existentes |
| **Frecuencia** | Baja (Diaria/Semanal) | Alta (Horaria/Minutal) |
| **Complejidad**| Alta (Specs, Imágenes, IA) | Baja (Solo Precio/Stock) |
| **Técnica** | Puppeteer (Navegador completo) | Fetch + HTML Parsing |

## Arquitectura y Flujo de Datos

El siguiente diagrama describe el flujo completo del proceso de recolección, desde la solicitud inicial hasta el almacenamiento en la base de datos.

```mermaid
graph TD
    %% Actores y Entradas
    User["Usuario / Cron"] -->|"POST /v1/:store/crawl"| API["API Server (Hono)"]
    
    %% Worker Principal
    subgraph Worker_Process ["Worker de Recolección"]
        API -->|"Spawn Worker"| Worker["Bun Worker"]
        Worker -->|Instantiate| Crawler["Store Crawler"]
        
        %% Fase de Crawling
        Crawler -->|"1. Fetch URLs"| StoreWeb["Sitio Web Tienda"]
        StoreWeb -->|HTML| Crawler
        Crawler -->|"2. Parse HTML"| RawData["Datos Crudos (ProductData)"]
        
        %% Fase de Procesamiento
        RawData -->|"3. Validate"| Validator{"Es Válido?"}
        Validator -- No --> Skip["Saltar / Log Error"]
        Validator -- Si --> BrandRes["4. Resolver Marca (DB)"]
        
        BrandRes -->|"5. Normalize Specs"| Normalizer{"Tipo de Normalización"}
        
        %% Sub-flujo de Normalización
        subgraph Normalization ["Normalización de Especificaciones"]
            Normalizer -- "HDD/SSD + MPN" --> AI_Check{"Check Cache IA"}
            
            AI_Check -- Miss --> LLM["LLM API (Groq/DeepSeek)"]
            LLM -->|Extract| CacheSave["Guardar en Cache DB"]
            CacheSave --> AISpecs["Specs IA"]
            
            AI_Check -- Hit --> AISpecs
            
            Normalizer -- "Otros / Sin MPN" --> Regex["Procesador Regex Tradicional"]
        end
        
        AISpecs --> MergedSpecs["Specs Finales"]
        Regex --> MergedSpecs
        
        %% Fase de Persistencia
        MergedSpecs -->|"6. Check Product"| DB_Check{"Existe Producto?"}
        
        DB_Check -- No --> ImgUpload["Subir Imagen"]
        ImgUpload --> Storage["Supabase Storage"]
        Storage --> CreateProd["Crear Producto en DB"]
        
        DB_Check -- Si --> UpdateProd["Actualizar Specs en DB"]
        
        CreateProd --> UpsertList["7. Upsert Listing (Precio/Stock)"]
        UpdateProd --> UpsertList
        
        UpsertList --> History["8. Guardar Historial de Precio"]
    end
    
    %% Almacenamiento Externo
    History --> DB[("Supabase Database")]
    BrandRes -.-> DB
    AI_Check -.-> DB
```

## Ejecución en Producción (Coolify)

Este servicio está diseñado para ejecutarse como tareas programadas (Scheduled Tasks) en Coolify o mediante CRON jobs.

### Healthcheck

Definir un healthcheck para verificar la salud del servicio:

- **Método**: `GET`
- **Esquema**: `http`
- **Host**: `localhost`
- **Puerto**: `3001`
- **Path**: `/health`
- **Código de retorno esperado**: `200`
- **Texto de respuesta esperado**: `OK`
- **Intervalo (s)**: `30`
- **Timeout (s)**: `10`
- **Retries**: `3`
- **Start Period (s)**: `30`

### Endpoints de Ejecución

El servicio expone endpoints HTTP para iniciar los procesos de recolección (crawling).

#### PC Express
Ejecutar recolección de todas las categorías (Recomendado: 03:00 AM):
```bash
curl -X POST http://localhost:3001/v1/pc-express/crawl
```

#### SP Digital
Ejecutar recolección de todas las categorías (Recomendado: 04:00 AM):
```bash
curl -X POST http://localhost:3001/v1/sp-digital/crawl
```

También es posible ejecutar una categoría específica pasando el parámetro `category`:
```bash
curl -X POST "http://localhost:3001/v1/pc-express/crawl?category=gpu"
```

## Tiendas Soportadas

Actualmente el collector soporta las siguientes tiendas chilenas de hardware:

- **PC Express** (`pc-express`)
- **SP Digital** (`sp-digital`)
- **BIP** (`bip`)

## Categorías Soportadas

El sistema cuenta con procesadores especializados (Regex + IA) para normalizar las especificaciones de los siguientes componentes:

| Categoría | Slug | Procesamiento |
|-----------|------|---------------|
| Procesadores | `cpu` | Socket, Frecuencia, Núcleos, Caché |
| Tarjetas de Video | `gpu` | Chipset, VRAM, Modelo |
| Placas Madre | `motherboard` | Socket, Chipset, Formato, Tipo RAM |
| Memorias RAM | `ram` | Capacidad, Frecuencia, Latencia, Tipo |
| Almacenamiento SSD | `ssd` | Capacidad, Formato, Interfaz |
| Almacenamiento HDD | `hdd` | Capacidad, RPM, Cache |
| Fuentes de Poder | `psu` | Potencia, Certificación, Modularidad |
| Gabinetes | `case` | Formato, Color, Panel Lateral |
| Coolers CPU | `cpu_cooler` | Tipo (Aire/AIO), Tamaño Radiador |
| Ventiladores | `case_fan` | Tamaño, RGB, Pack |

## Stack Tecnológico

- **Runtime**: [Bun](https://bun.sh) (v1.1+)
- **Framework Web**: [Hono](https://hono.dev)
- **Scraping**: [Puppeteer](https://pptr.dev) (Headless Chrome)
- **Base de Datos**: [Supabase](https://supabase.com) (PostgreSQL)
- **IA / LLM**: OpenAI SDK (Compatible con Groq/DeepSeek) para extracción de specs complejas.
- **Procesamiento de Imágenes**: [Sharp](https://sharp.pixelplumbing.com)

## Estructura del Proyecto

```
src/
├── crawlers/       # Lógica de navegación por tienda (BaseCrawler)
├── processors/     # Lógica de extracción de specs por categoría
│   ├── ai/         # Extractores basados en LLM
│   └── normalizers/# Normalizadores Regex y limpieza de texto
├── workers/        # Bun Workers para ejecución paralela
├── lib/            # Utilidades (Supabase, Logger, Storage)
├── routes/         # Endpoints de la API
└── queues/         # Gestión de colas de procesamiento
```

## Instalación y Desarrollo

```bash
# Instalar dependencias
bun install

# Iniciar servidor en modo watch
bun run dev
```
El servidor iniciará en `http://localhost:3001`.

### Tests

El proyecto incluye tests unitarios para validar la normalización de datos:

```bash
bun test
```
