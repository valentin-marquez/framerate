// Extrae las specs de cada ficha con Haiku por la API (sin subagentes): bun extract.ts <dir> <lote.txt> [concurrencia]
// Necesita ANTHROPIC_API_KEY en el entorno (o en apps/normalize/.dev.vars).
import Anthropic from "@anthropic-ai/sdk";

const [S, batch, conc = "3"] = process.argv.slice(2);
const key =
  process.env.ANTHROPIC_API_KEY ??
  (
    await Bun.file("apps/normalize/.dev.vars")
      .text()
      .catch(() => "")
  )
    .match(/ANTHROPIC_API_KEY=(.+)/)?.[1]
    ?.trim();
if (!key) throw new Error("falta ANTHROPIC_API_KEY");
const client = new Anthropic({ apiKey: key });
const MODEL = "claude-haiku-5-5";
const SYSTEM = `Eres un extractor de fichas técnicas de placas madre. Recibes el texto de una ficha oficial con cabeceras "# brand", "# catalog_name", "# product_id", "# source_url". Devuelve SOLO un objeto JSON con exactamente estas claves; lo que la ficha no dice va null, nunca completes de memoria.
product_id (número de la cabecera), catalog_name, source_url, brand ("ASUS"|"MSI"|"Gigabyte"), model (nombre oficial sin la marca, p. ej. "PRIME B760M-A D4-CSM", "PRO B840M-B", "B550M K"; si la ficha no lo dice, derívalo del slug de source_url en mayúsculas), socket ("AM4"|"AM5"|"LGA1700"|"LGA1851"|"LGA1200"|"LGA1151"|"sTR5", sin espacios), chipset (sólo el código), form_factor ("atx"|"matx"|"itx"|"eatx"), memory_type ("ddr4"|"ddr5"), memory_slots (entero), memory_max_gb (entero), memory_max_speed_mt_s (entero: la mayor velocidad listada aunque sea OC; "7800+(OC)" → 7800), memory_max_speed_jedec_mt_s (la mayor sin OC si la ficha la distingue, si no null), m2_slots (ranuras M.2 de almacenamiento, sin la Key E de Wi-Fi), pcie_x16_slots (ranuras físicas x16; una ranura descrita para dos generaciones de CPU cuenta una vez), sata_ports, cpu_fan_headers (CPU Fan + CPU OPT + AIO/W_PUMP), chassis_fan_headers (Chassis/System Fan), argb_5v_headers ("Addressable Gen 2", "Addressable RGB", "JARGB", "Rainbow LED 3-pin"), rgb_12v_headers ("Aura RGB", "RGB header", "JRGB", 4-pin 12V), usb_c_front_header (true si hay conector interno USB Type-C frontal; false si la lista de conectores internos existe y no lo trae; null si no hay lista), bios_flashback (true si menciona BIOS FlashBack o Flash BIOS Button; Q-Flash de Gigabyte no cuenta; false si la sección BIOS existe y no lo menciona; null si no hay sección), wifi ("Wi-Fi 5"|"Wi-Fi 6"|"Wi-Fi 6E"|"Wi-Fi 7"|null), ethernet (texto corto como "2.5 Gb Realtek"|null), notes (una línea con dudas o null).`;
const files = (await Bun.file(batch).text()).split("\n").filter(Boolean);
const out: unknown[] = [];
let i = 0,
  inTok = 0,
  outTok = 0;
async function worker() {
  while (i < files.length) {
    const f = files[i++];
    const text = await Bun.file(f).text();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await client.messages.create({
          model: MODEL,
          max_tokens: 800,
          system: SYSTEM,
          messages: [{ role: "user", content: text.slice(0, 40_000) }],
        });
        inTok += r.usage.input_tokens;
        outTok += r.usage.output_tokens;
        const raw = r.content.find((c) => c.type === "text")?.text ?? "";
        const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
        out.push(JSON.parse(json));
        break;
      } catch (e) {
        if (attempt === 2) console.error("FALLO", f.split("/").pop(), (e as Error).message);
        else await Bun.sleep(2000 * (attempt + 1));
      }
    }
  }
}
await Promise.all(Array.from({ length: Number(conc) }, worker));
const name = batch
  .split("/")
  .pop()!
  .replace(/\.txt$/, ".json");
await Bun.write(`${S}/extracted/${name}`, JSON.stringify(out, null, 1));
console.log(`${name}: ${out.length}/${files.length} fichas, tokens entrada ${inTok}, salida ${outTok}`);
