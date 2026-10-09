-- El preprocesador ve los productos más parecidos del catálogo y dice cuál es el mismo SKU (#157). `apps/match` lo usa
-- cuando la decisión por identificador o clave no vincula; null si Haiku no vio ninguno igual.
ALTER TABLE listing_identity ADD COLUMN same_as INTEGER;
