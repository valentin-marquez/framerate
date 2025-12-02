-- Corregir problemas de rendimiento de RLS reportados por Supabase Advisor
-- 1. Envolver auth.uid() en (select auth.uid()) para evitar re-evaluación por fila
-- 2. Resolver múltiples políticas permisivas en quotes y quote_items

-- Perfiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING ((select auth.uid()) = id);

-- Reseñas de tiendas
DROP POLICY IF EXISTS "Users can create store reviews" ON public.store_reviews;
DROP POLICY IF EXISTS "Users can update their own store reviews" ON public.store_reviews;

CREATE POLICY "Users can create store reviews" ON public.store_reviews
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own store reviews" ON public.store_reviews
    FOR UPDATE USING ((select auth.uid()) = user_id);

-- Reseñas de productos
DROP POLICY IF EXISTS "Users can create product reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Users can update their own product reviews" ON public.product_reviews;

CREATE POLICY "Users can create product reviews" ON public.product_reviews
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own product reviews" ON public.product_reviews
    FOR UPDATE USING ((select auth.uid()) = user_id);

-- Alertas de precio
DROP POLICY IF EXISTS "Users can manage their price alerts" ON public.price_alerts;

CREATE POLICY "Users can manage their price alerts" ON public.price_alerts
    FOR ALL USING ((select auth.uid()) = user_id);

-- Cotizaciones
-- Eliminar políticas superpuestas
DROP POLICY IF EXISTS "Public quotes are viewable by everyone" ON public.quotes;
DROP POLICY IF EXISTS "Users can manage their quotes" ON public.quotes;

-- Dividir en acciones específicas para evitar superposición y corregir auth.uid()
CREATE POLICY "Quotes are viewable by everyone" ON public.quotes
    FOR SELECT USING (is_public = true OR user_id = (select auth.uid()));

CREATE POLICY "Users can insert quotes" ON public.quotes
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update quotes" ON public.quotes
    FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete quotes" ON public.quotes
    FOR DELETE USING (user_id = (select auth.uid()));

-- Ítems de cotización
-- Eliminar políticas superpuestas
DROP POLICY IF EXISTS "Public quote_items are viewable by everyone" ON public.quote_items;
DROP POLICY IF EXISTS "Users can manage their quote items" ON public.quote_items;

-- Dividir en acciones específicas para evitar superposición y corregir auth.uid()
CREATE POLICY "Quote items are viewable by everyone" ON public.quote_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.quotes 
            WHERE id = quote_items.quote_id 
            AND (is_public = true OR user_id = (select auth.uid()))
        )
    );

CREATE POLICY "Users can insert quote items" ON public.quote_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.quotes 
            WHERE id = quote_items.quote_id 
            AND user_id = (select auth.uid())
        )
    );

CREATE POLICY "Users can update quote items" ON public.quote_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.quotes 
            WHERE id = quote_items.quote_id 
            AND user_id = (select auth.uid())
        )
    );

CREATE POLICY "Users can delete quote items" ON public.quote_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.quotes 
            WHERE id = quote_items.quote_id 
            AND user_id = (select auth.uid())
        )
    );

