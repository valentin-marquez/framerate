import { Logger } from "@framerate/utils";
import OpenAI from "openai";
import { config } from "@/config";

const logger = new Logger("LLM");

if (!config.DEEPSEEK_API_KEY) {
  throw new Error("DEEPSEEK_API_KEY not configured");
}

const openai = new OpenAI({ apiKey: config.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });
export async function callLLM(params: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming>) {
  const paramsWithDefaults: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    ...params,
    model: params?.model ?? config.AI_MODEL,
    temperature: params?.temperature ?? 0,
    top_p: params?.top_p ?? 1,
    messages: params?.messages ?? [],
  };

  const makeRequest = async () => {
    try {
      return await openai.chat.completions.create(paramsWithDefaults);
    } catch (error: unknown) {
      // DeepSeek claims to not constrain rate; still handle transient server errors with a retry
      const err = error as { status?: number } | undefined;
      if (err?.status === 429 || (err?.status && err.status >= 500 && err.status < 600)) {
        logger.warn("Transient server error from DeepSeek, retrying after delay...");
        await new Promise((r) => setTimeout(r, 2000));
        return await openai.chat.completions.create(paramsWithDefaults);
      }
      throw error;
    }
  };

  // No rate-limiting enforced here (DeepSeek handles scaling). Fire requests as fast as possible.
  return makeRequest();
}
