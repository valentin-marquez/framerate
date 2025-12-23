#!/usr/bin/env bun
/*
  myshop-request.ts

  ------------------------------------------------------------
  Types de la respuesta de la API de MyShop (POST /servicio/producto)
  ------------------------------------------------------------
  export interface MyShopResponse {
    codigo: number;
    servicio: string;
    mensaje: string;
    resultado: {
      titulo: string;
      precio: {
        min: number;
        max: number;
      };
      filtro: MyShopFiltro[];
      items: MyShopItem[];
      productos: {
        ini: number;
        fin: number;
        count: number;
      };
      orden: MyShopOrden[];
      registros: MyShopRegistro[];
      paginacion: MyShopPaginacion[];
      paginacion_show: boolean;
      mensaje: string | null;
    };
  }

  export interface MyShopFiltro {
    titulo: string;
    param: string;
    datos: MyShopFiltroDato[];
  }

  export interface MyShopFiltroDato {
    name: string;
    value: string | number;
    cuenta: number;
    sort: string | number;
    cuenta_total: number;
    selected: boolean;
  }

  export interface MyShopItem {
    id_producto: number;
    id_familia: number;
    familia: string;
    codigo: string;
    liq: number;
    api: number;
    nombre: string;
    partno: string;
    id_marca: number;
    marca: string;
    marca_foto: string;
    oferta: boolean;
    descuento: number;
    precio: number;
    precio_fmt: string;
    precio_normal: number;
    precio_normal_fmt: string;
    precio_tarjeta: number;
    precio_tarjeta_fmt: string;
    nuevo: number;
    garantia: string | null;
    url: string;
    foto: string;
    fotoSecundaria: string;
    fotoMini: string;
    stock_total: number;
    stock_total_fmt: string;
    fecha_creacion: string;
    texto: string;
    label: string | boolean | null;
    disponibleInternet: boolean;
    disponibleTienda: boolean;
  }

  export interface MyShopOrden {
    name: string;
    value: string;
    cuenta: number | null;
    sort: string;
    cuenta_total: number | null;
    selected: boolean;
  }

  export interface MyShopRegistro {
    name: string;
    value: number;
    cuenta: number | null;
    sort: string;
    cuenta_total: number | null;
    selected: boolean;
  }

  export interface MyShopPaginacion {
    link: string;
    pagina?: number;
    name: string | number;
    activo: boolean;
    class?: string;
  }
  -----------------
  Replica del curl POST a https://www.myshop.cl/servicio/producto
  - Usa Bun (soporta TypeScript nativamente)
  - Permite pasar algunos parámetros por línea de comando

  ------------------------------------------------------------
  Filtros posibles para la API de MyShop (POST /servicio/producto)
  ------------------------------------------------------------
  Los filtros varían según el idFamilia:

  idFamilia=32 (Placas Madres)
  --------------------------------
  - filtro_marca: string[]
  - filtro_categoria: string[]
  - filtro_diferida: string[]
  - filtro_tab_socket: string[]
  - filtro_tab_factor-de-forma: string[]
  - filtro_tab_slots-de-memoria: string[]
  - filtro_tab_tipo-de-memoria: string[]

  idFamilia=64 (Fuentes de Poder)
  --------------------------------
  - filtro_marca: string[]
  - filtro_tab_potencia-fuente: string[]
  - filtro_tab_modular: string[]

  idFamilia=33 (Tarjetas de Video)
  --------------------------------
  - filtro_marca: string[]
  - filtro_diferida: string[]
  - filtro_tab_fabricante: string[]
  - filtro_tab_cantidad-de-memoria: string[]
  - filtro_tab_serie: string[]

  idFamilia=35 (Memorias RAM)
  --------------------------------
  - filtro_marca: string[]
  - filtro_categoria: string[]
  - filtro_diferida: string[]
  - filtro_tab_tipo-de-memoria: string[]
  - filtro_tab_capacidad-memoria: string[]
  - filtro_tab_frecuencia: string[]

  idFamilia=150 (Ventilador CPU)
  --------------------------------
  - filtro_marca: string[]
  - filtro_tab_socket: string[]

  idFamilia=151 (Refrigeración Líquida)
  --------------------------------
  - filtro_marca: string[]
  - filtro_diferida: string[]
  - filtro_tab_socket: string[]
  - filtro_tab_tamano-disipador: string[]

  idFamilia=148 (Ventiladores Gabinete)
  --------------------------------
  - filtro_marca: string[]
  - filtro_tab_tamano: string[]
  - filtro_tab_color: string[]
  - filtro_tab_iluminacion: string[]
  - filtro_tab_pack: string[]

  idFamilia=143 (Procesadores)
  --------------------------------
  - filtro_marca: string[]
  - filtro_categoria: string[]
  - filtro_diferida: string[]
  - filtro_tab_linea-de-procesador: string[]
  - filtro_tab_socket: string[]
  - filtro_tab_ventilador: string[]
  - filtro_tab_gpu-integrada: string[]

  idFamilia=71 (Partes y procesadores)
  ------------------------------------
  - filtro_marca: string[]
  - filtro_categoria: string[]
  - filtro_diferida: string[]
  - Otros filtros pueden variar según la subcategoría (consultar respuesta de la API para descubrirlos).

  Notas:
  - Los nombres de los filtros pueden cambiar según la familia/categoría.
  - Para obtener todos los filtros posibles para una familia específica, inspeccionar la respuesta de la API o la interfaz web de MyShop.
  - Los valores de cada filtro suelen ser arreglos de strings.
  - Ejemplo de payload con filtros:
    {
      "tipo": "3",
      "page": "1",
      "idFamilia": "143",
      "filtro_marca": ["AMD", "Intel"],
      "filtro_tab_socket": ["AM4", "AM5"]
    }
  ------------------------------------------------------------

  Usage:
    bun ./myshop-request.ts --tipo=3 --page=1 --idFamilia=71

  OR simply: bun ./myshop-request.ts

*/

const DEFAULTS = {
	tipo: "3",
	page: "1",
	idFamilia: "143",
	url: "https://www.myshop.cl/servicio/producto",
	userAgent:
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0",
};

function parseArgs() {
	const args = process.argv.slice(2);
	const out: Record<string, string> = { ...DEFAULTS };
	for (const arg of args) {
		const match = arg.match(/^--([a-zA-Z0-9_-]+)=(.*)$/);
		if (match) {
			out[match[1]] = match[2];
		}
	}
	return out;
}

async function main() {
	const opts = parseArgs();

	const payload = {
		tipo: opts.tipo,
		page: opts.page,
		idFamilia: opts.idFamilia,
	};

	const bodyStr = JSON.stringify(payload);

	const headers: Record<string, string> = {
		Host: "www.myshop.cl",
		"User-Agent": opts.userAgent,
		Accept: "application/json, text/plain, */*",
		"Accept-Language": "es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3",
		"Accept-Encoding": "gzip, deflate, br",
		"Content-Type": "application/json",
		// Content-Length likely will be set by fetch automatically; we can set it as well if we want an exact match
		"Content-Length": String(new TextEncoder().encode(bodyStr).length),
		Origin: "https://www.myshop.cl",
		"Sec-Gpc": "1",
		Referer: "https://www.myshop.cl/partes-y-piezas-procesadores",
		"Sec-Fetch-Dest": "empty",
		"Sec-Fetch-Mode": "cors",
		"Sec-Fetch-Site": "same-origin",
		Te: "trailers",
	};

	try {
		console.log("> POST", opts.url);
		console.log("> payload:", bodyStr);

		const res = await fetch(opts.url, {
			method: "POST",
			headers,
			body: bodyStr,
		});

		console.log("> status:", res.status, res.statusText);
		// Print relevant response headers
		const contentType = res.headers.get("content-type") || "";

		console.log("> response content-type:", contentType);

		if (contentType.includes("application/json")) {
			const json = await res.json();
			console.log("> response JSON:", JSON.stringify(json, null, 2));
		} else {
			const text = await res.text();
			console.log("> response text:", text.slice(0, 240));
			if (text.length > 240) console.log("... (truncated)");
		}
	} catch (error) {
		console.error("Request failed:", error);
		process.exitCode = 1;
	}
}

main();
