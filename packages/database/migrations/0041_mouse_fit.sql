-- Recomendación de mouses por mano y agarre (#218). `hand_profiles`: las medidas de quien tiene cuenta. Sin cuenta
-- quedan en su navegador.
CREATE TABLE hand_profiles (
  user_id     TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  length_mm   REAL NOT NULL CHECK (length_mm BETWEEN 120 AND 250),
  width_mm    REAL NOT NULL CHECK (width_mm BETWEEN 60 AND 130),
  grip        TEXT NOT NULL CHECK (grip IN ('palm', 'claw', 'fingertip')),
  updated_at  TEXT NOT NULL
) WITHOUT ROWID;

-- Casos de calibración, anónimos: sin usuario, IP ni hora exacta, para que no se puedan cruzar con los logs. Guarda el
-- producto y no sus medidas, porque el mouse puede recibir referencia después; si el matching lo fusiona, el caso queda
-- sin producto y sale de la revisión.
CREATE TABLE mouse_fit_reports (
  id              INTEGER PRIMARY KEY,
  hand_length_mm  REAL NOT NULL CHECK (hand_length_mm BETWEEN 120 AND 250),
  hand_width_mm   REAL NOT NULL CHECK (hand_width_mm BETWEEN 60 AND 130),
  grip            TEXT NOT NULL CHECK (grip IN ('palm', 'claw', 'fingertip')),
  product_id      INTEGER REFERENCES products (id) ON DELETE SET NULL,
  fit             TEXT NOT NULL CHECK (fit IN ('small', 'right', 'large')),
  reported_on     TEXT NOT NULL
);
