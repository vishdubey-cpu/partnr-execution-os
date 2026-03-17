/**
 * AI Task Extractor
 * - If OPENAI_API_KEY is set, uses GPT to extract tasks from meeting notes.
 * - Otherwise, uses a deterministic rule-based mock extractor.
 */

export interface ExtractedTask {
  title: string;
  description: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  dueDate: string;
  priority: string;
  function: string;
  source: string;
  confidenceScore: number;
  needsReview: boolean;
}

// ── Keyword helpers ───────────────────────────────────────────────

const FUNCTION_KEYWORDS: Record<string, string[]> = {
  HR: ["hire", "hiring", "onboard", "leave", "attrition", "culture", "employee", "recruit", "performance review", "hr"],
  Sales: ["sales", "revenue", "pricing", "deal", "prospect", "client", "crm", "quota", "pipeline"],
  Operations: ["ops", "operations", "vendor", "office", "cluster", "sop", "process", "logistics", "supply"],
  Finance: ["finance", "budget", "p&l", "reconciliation", "invoice", "payment", "cost", "expense", "audit"],
  Technology: ["tech", "deploy", "dashboard", "api", "system", "integration", "server", "database", "codebase", "software"],
  Strategy: ["strategy", "board", "okr", "planning", "q2", "q1", "roadmap", "objective", "vision"],
  Marketing: ["marketing", "campaign", "brand", "social media", "content", "email"],
};

const PRIORITY_KEYWORDS = {
  CRITICAL: ["urgent", "asap", "critical", "blocker", "immediately", "today"],
  HIGH: ["important", "high priority", "priority", "must", "this week"],
  MEDIUM: ["medium", "soon", "follow up"],
  LOW: ["low", "when possible", "nice to have"],
};

const ACTION_WORDS = [
  "to ", "will ", "should ", "must ", "needs to ", "need to ", "has to ", "have to ", "action:",
  "send ", "prepare ", "review ", "update ", "submit ", "check ", "fix ", "complete ",
  "ensure ", "follow up", "deploy ", "create ", "build ", "test ", "launch ", "share ",
  "coordinate ", "confirm ", "arrange ", "draft ", "finalize ", "present ", "schedule ",
  "call ", "email ", "connect ", "discuss ", "handle ", "manage ", "own ", "lead ",
];

// ── Date helpers ──────────────────────────────────────────────────

const MONTH_NAMES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDateHint(text: string, referenceDate: Date): string | null {
  const lower = text.toLowerCase();

  // ISO format
  const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // today / tomorrow / eod
  if (/\btoday\b|\beod\b|\bend of day\b/.test(lower)) {
    return referenceDate.toISOString().split("T")[0];
  }
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }

  // "22 Mar", "22nd Mar", "22nd March", "March 22", "30th MArch"
  const namedMatch = lower.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/
  );
  const namedMatch2 = lower.match(
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?/
  );
  const match = namedMatch || namedMatch2;
  if (match) {
    const day = parseInt(namedMatch ? match[1] : match[2]);
    const monthStr = (namedMatch ? match[2] : match[1]).slice(0, 3);
    const month = MONTH_NAMES[monthStr];
    const year = referenceDate.getFullYear();
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // Relative: next week
  if (lower.includes("next week")) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  }

  // Relative: by Friday / this Friday
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < dayNames.length; i++) {
    if (lower.includes(dayNames[i])) {
      const d = new Date(referenceDate);
      const diff = (i - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      return d.toISOString().split("T")[0];
    }
  }

  // "in X days"
  const inDaysMatch = lower.match(/in\s+(\d+)\s+days?/);
  if (inDaysMatch) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + parseInt(inDaysMatch[1]));
    return d.toISOString().split("T")[0];
  }

  return null;
}

// Strip date phrases from a task title so "Do X by 30th March" → "Do X"
function stripDateFromTitle(title: string): string {
  return title
    .replace(/\s+by\s+\d{1,2}(?:st|nd|rd|th)?\s+\w+/gi, "")
    .replace(
      /\s+by\s+(?:today|tomorrow|eod|end of day|next week|this week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi,
      ""
    )
    .replace(/\s+by\s+\d{4}-\d{2}-\d{2}/g, "")
    .replace(/\s+by\s+\d{1,2}\s*(?:pm|am)/gi, "")
    .trim();
}

function detectPriority(text: string): string {
  const lower = text.toLowerCase();
  for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return priority;
  }
  return "MEDIUM";
}

function detectFunction(text: string): string {
  const lower = text.toLowerCase();
  for (const [fn, keywords] of Object.entries(FUNCTION_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return fn;
  }
  return "";
}

function extractOwnerAndAction(line: string): { owner: string; title: string } | null {
  // Pattern 1: "Name will/to/should do X" at start of line
  const startMatch = line.match(
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(to|will|should|must|needs? to|has? to)\s+(.+)/
  );
  if (startMatch) {
    return { owner: startMatch[1], title: capitalise(startMatch[3]) };
  }

  // Pattern 2: Mid-sentence "... Name will/to/should do X" (e.g. "We agreed that Ravi will send...")
  const midMatch = line.match(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(will|should|must|needs to|need to|has to|have to)\s+(.{6,})/
  );
  if (midMatch) {
    return { owner: midMatch[1], title: capitalise(midMatch[3]) };
  }

  // Pattern 3: "Action: Name - Do X" or "Action: Do X"
  const actionMatch = line.match(/^(?:action|todo|task):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)[\s\-–:]+(.+)/i);
  if (actionMatch) {
    return { owner: actionMatch[1], title: capitalise(actionMatch[2]) };
  }

  // Pattern 4: "Name: Do X" (simple colon pattern like "Rahul: send deck by Friday")
  const colonMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?):\s+(.{6,})/);
  if (colonMatch) {
    return { owner: colonMatch[1], title: capitalise(colonMatch[2]) };
  }

  return null;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).trim();
}

function isActionLine(line: string): boolean {
  const lower = line.toLowerCase();
  // List item or action prefix
  if (/^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line) || /^\[\s*\]/.test(line)) return true;
  if (/^(action|todo|task):/i.test(line)) return true;
  // Contains action verbs
  return ACTION_WORDS.some((w) => lower.includes(w));
}

// ── Mock extractor (no API key needed) ───────────────────────────

export function mockExtractTasks(
  notes: string,
  meetingName: string,
  meetingDate: Date
): ExtractedTask[] {
  // Step 1: split by newlines
  const rawLines = notes
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 8);

  // Step 2: for prose lines (no bullet/list marker), also split by sentence boundary
  // This handles "Ravi will send deck. Priya will fix dashboard." as a single line
  const lines: string[] = [];
  for (const raw of rawLines) {
    const isBullet = /^[-*•\d.]/.test(raw) || /^(action|todo|task):/i.test(raw);
    if (isBullet) {
      lines.push(raw);
    } else {
      // Split on ". " or "; " — keeps sentence-ending punctuation attached to previous word
      const sentences = raw.split(/\.\s+|;\s+/).map((s) => s.trim()).filter((s) => s.length > 8);
      lines.push(...(sentences.length > 1 ? sentences : [raw]));
    }
  }

  const tasks: ExtractedTask[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (!isActionLine(line)) continue;

    // Strip list markers
    const cleaned = line.replace(/^[-*•\d.]+\s*/, "").replace(/^\[\s*\]\s*/, "").trim();
    if (cleaned.length < 6) continue;

    const ownerExtract = extractOwnerAndAction(cleaned);
    const owner = ownerExtract?.owner || "";
    // Parse date from this line only (not the whole notes), then strip it from title
    const dueDate = parseDateHint(line, meetingDate) || "";
    const rawTitle = ownerExtract?.title || capitalise(cleaned.replace(/^(action|todo|task):\s*/i, ""));
    const title = stripDateFromTitle(rawTitle) || rawTitle;

    // Deduplicate by title
    const key = title.toLowerCase().slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);

    const priority = detectPriority(line);
    const fn = detectFunction(line) || detectFunction(meetingName);

    tasks.push({
      title,
      description: `Extracted from: ${meetingName} (${meetingDate.toDateString()})`,
      ownerName: owner,
      ownerPhone: "",
      ownerEmail: "",
      dueDate,
      priority,
      function: fn,
      source: meetingName,
      confidenceScore: owner && dueDate ? 0.85 : owner ? 0.65 : 0.4,
      needsReview: !owner || !dueDate,
    });

    if (tasks.length >= 15) break; // cap at 15 per meeting
  }

  return tasks;
}

// ── OpenAI extractor ─────────────────────────────────────────────

async function openAIExtractTasks(
  notes: string,
  meetingName: string,
  meetingDate: Date
): Promise<ExtractedTask[]> {
  const prompt = `Extract all action items and tasks from the following meeting notes.

Meeting: ${meetingName}
Date: ${meetingDate.toDateString()}

Notes:
${notes}

Return a JSON array of tasks. Each task must have:
- title (string, concise action title)
- description (string, context from notes)
- ownerName (string, person responsible — empty string if unclear)
- ownerPhone (string, always empty string)
- ownerEmail (string, always empty string)
- dueDate (string, ISO format YYYY-MM-DD — empty string if unclear)
- priority (string: LOW | MEDIUM | HIGH | CRITICAL)
- function (string: HR | Sales | Operations | Finance | Technology | Strategy | Marketing | empty)
- source (string, set to "${meetingName}")
- confidenceScore (number 0.0-1.0)
- needsReview (boolean, true if owner or dueDate is missing)

Return ONLY a valid JSON array, no markdown, no explanation.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content || "[]";
  const parsed = JSON.parse(content);
  // Handle both {tasks:[...]} and [...] responses
  return Array.isArray(parsed) ? parsed : parsed.tasks || [];
}

// ── Main exported function ────────────────────────────────────────

export async function extractTasksFromNotes(
  notes: string,
  meetingName: string,
  meetingDate: Date
): Promise<ExtractedTask[]> {
  if (process.env.OPENAI_API_KEY && process.env.AI_PROVIDER !== "MOCK") {
    try {
      return await openAIExtractTasks(notes, meetingName, meetingDate);
    } catch (err) {
      console.warn("[AI Extractor] OpenAI failed, falling back to mock:", err);
    }
  }
  return mockExtractTasks(notes, meetingName, meetingDate);
}
