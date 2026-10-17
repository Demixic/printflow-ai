import { createGeminiBriefModel, DEFAULT_GEMINI_MODEL } from "./gemini";
import { createBriefService, type BriefService } from "./service";

let service: BriefService | undefined;

/** The app's brief service. GEMINI_API_KEY is read server-side only. */
export function getBriefService(): BriefService {
  if (!service) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
    service = createBriefService({ model: apiKey ? createGeminiBriefModel({ apiKey, model }) : null });
  }
  return service;
}
