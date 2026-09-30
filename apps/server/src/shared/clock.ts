/** Reloj inyectable: los casos de uso reciben `now()` para que los tests sean deterministas. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export const iso = (clock: Clock) => clock().toISOString();
