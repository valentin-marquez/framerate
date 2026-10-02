const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

/** Id corto y no adivinable para URLs (`/soporte/:id`, `/cotizacion/:id`). Sin caracteres que se confundan. */
export const newPublicId = (length = 8) =>
  Array.from(crypto.getRandomValues(new Uint32Array(length)), (n) => ALPHABET[n % ALPHABET.length]).join("");
