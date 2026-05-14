import { Logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

export class StoreService {
  private logger = new Logger("StoreService");

  /**
   * Returns `true` if the store with the given slug exists and is active.
   * Returns `false` if it exists and is inactive.
   * Returns `null` if the store does not exist.
   */
  async isActive(slug: string): Promise<boolean | null> {
    try {
      const { data, error } = await supabase.from("stores").select("is_active").eq("slug", slug).maybeSingle();

      if (error) {
        this.logger.error("Error querying stores table", String(error));
        throw error;
      }

      if (!data) {
        this.logger.info(`Store with slug '${slug}' not found`);
        return null;
      }

      return Boolean(data.is_active);
    } catch (err: unknown) {
      this.logger.error("Failed to check store active status", String(err));
      throw err;
    }
  }
}
