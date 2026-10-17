import { z } from "zod";
import { RECOMMENDATION_PRIORITIES, type BriefInput, type Recommendation } from "./types";

export const MAX_RECOMMENDATIONS = 6;
export const MAX_REFERENCES = 8;
const ORDER_NUMBER = /^PF-[1-9][0-9]{0,8}$/;

/** Strict validation applied to whatever the model returns. */
export const aiBriefSchema = z
  .object({
    summary: z.string().trim().min(1).max(500),
    recommendations: z
      .array(
        z
          .object({
            priority: z.enum(RECOMMENDATION_PRIORITIES),
            title: z.string().trim().min(1).max(100),
            explanation: z.string().trim().min(1).max(400),
            orderNumbers: z.array(z.string().regex(ORDER_NUMBER)).max(MAX_REFERENCES),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_RECOMMENDATIONS),
  })
  .strict();

export type AiBrief = z.infer<typeof aiBriefSchema>;

/**
 * Response schema sent to Gemini (`responseJsonSchema`). Limited to the JSON
 * Schema keywords the API supports; length and format limits are enforced by
 * `aiBriefSchema` after the response arrives.
 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Two or three sentences on the state of the production floor today.",
    },
    recommendations: {
      type: "array",
      minItems: 1,
      maxItems: MAX_RECOMMENDATIONS,
      items: {
        type: "object",
        properties: {
          priority: { type: "string", enum: [...RECOMMENDATION_PRIORITIES] },
          title: { type: "string", description: "Imperative, under 80 characters." },
          explanation: { type: "string", description: "Why, in one or two sentences, using the given facts." },
          orderNumbers: {
            type: "array",
            maxItems: MAX_REFERENCES,
            items: { type: "string", description: "An orderNumber from the input, e.g. PF-10491." },
          },
        },
        required: ["priority", "title", "explanation", "orderNumbers"],
        propertyOrdering: ["priority", "title", "explanation", "orderNumbers"],
      },
    },
  },
  required: ["summary", "recommendations"],
  propertyOrdering: ["summary", "recommendations"],
} as const;

export type ParseFailure = "invalid_json" | "schema_mismatch" | "unknown_order_reference";

export type ParseResult =
  | { ok: true; summary: string; recommendations: Recommendation[] }
  | { ok: false; failure: ParseFailure; detail: string };

/**
 * Validate a raw model response against the schema and the input it was given.
 * Any order number not present in the input rejects the whole response: a
 * hallucinated reference means the rest can't be trusted either.
 */
export function parseAiBrief(text: string | undefined, input: BriefInput): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text ?? "");
  } catch {
    return { ok: false, failure: "invalid_json", detail: "Response was not valid JSON." };
  }

  const parsed = aiBriefSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      failure: "schema_mismatch",
      detail: `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    };
  }

  const known = new Set(input.orders.map((o) => o.orderNumber));
  const unknown = parsed.data.recommendations.flatMap((r) => r.orderNumbers).filter((n) => !known.has(n));
  if (unknown.length > 0) {
    return {
      ok: false,
      failure: "unknown_order_reference",
      detail: `Referenced orders not in the input: ${[...new Set(unknown)].join(", ")}`,
    };
  }

  return {
    ok: true,
    summary: parsed.data.summary,
    recommendations: parsed.data.recommendations.map((r) => ({
      ...r,
      orderNumbers: [...new Set(r.orderNumbers)],
    })),
  };
}
