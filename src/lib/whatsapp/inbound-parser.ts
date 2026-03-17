/**
 * Parses inbound WhatsApp webhook payloads from Twilio or mock.
 * Returns a normalised reply event.
 */

export type InboundReplyType = "DONE" | "DELAYED" | "NEED_HELP" | "UNKNOWN";

export interface ParsedInboundMessage {
  from: string;       // phone number (e.g. +919876543210)
  body: string;       // raw message text
  replyType: InboundReplyType;
  revisedDate?: string; // extracted date if DELAYED reply contains one
  rawPayload: Record<string, string>;
}

/** Parse Twilio-format WhatsApp inbound webhook */
export function parseTwilioWebhook(
  body: Record<string, string>
): ParsedInboundMessage {
  const from = (body.From || "").replace("whatsapp:", "").trim();
  const rawText = (body.Body || "").trim();
  const replyType = classifyReply(rawText);
  const revisedDate = replyType === "DELAYED" ? extractDateFromText(rawText) : undefined;

  return { from, body: rawText, replyType, revisedDate, rawPayload: body };
}

/** Parse mock/test inbound payload */
export function parseMockWebhook(
  body: Record<string, string>
): ParsedInboundMessage {
  const from = (body.from || body.From || "").trim();
  const rawText = (body.body || body.Body || "").trim();
  const replyType = classifyReply(rawText);
  const revisedDate = replyType === "DELAYED" ? extractDateFromText(rawText) : undefined;

  return { from, body: rawText, replyType, revisedDate, rawPayload: body };
}

function classifyReply(text: string): InboundReplyType {
  const upper = text.toUpperCase().trim();
  if (upper === "DONE" || upper === "COMPLETED" || upper === "1") return "DONE";
  if (upper.startsWith("DELAYED") || upper === "DELAY" || upper === "2") return "DELAYED";
  if (upper.startsWith("NEED HELP") || upper === "HELP" || upper === "3") return "NEED_HELP";
  return "UNKNOWN";
}

/** Try to extract a date string from messages like "DELAYED by 22 Mar" or "DELAYED - will finish by Friday" */
function extractDateFromText(text: string): string | undefined {
  const datePatterns = [
    /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{0,4})/i,
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/,
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return undefined;
}
