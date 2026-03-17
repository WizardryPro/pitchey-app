/**
 * AI Production Auto-Fill Handler
 * Accepts a document upload (PDF/TXT/DOCX), sends it to Claude API,
 * returns structured production assessment data: checklist recommendations,
 * team suggestions, and categorized production notes.
 * Costs 5 credits per extraction.
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

const AUTOFILL_CREDIT_COST = 5;

const AUTOFILL_PROMPT = `You are a production assessment AI for a movie/TV pitch platform. You are analyzing a film/TV document (script, treatment, pitch deck, or synopsis) to generate a production feasibility assessment.

Analyze the document and return ONLY valid JSON with no markdown formatting, no code blocks, no explanation — just the JSON object.

{
  "checklist": {
    "scriptAnalysis": true or false — is there enough script/story detail to begin analysis?,
    "budgetBreakdown": true or false — are there enough production details to estimate a budget?,
    "locationScouting": true or false — are specific locations mentioned that could be scouted?,
    "castingPlan": true or false — are characters defined well enough to begin casting?,
    "crewAssembly": true or false — is the scope clear enough to determine crew needs?,
    "equipmentList": true or false — are technical/visual requirements specified?,
    "insuranceCoverage": true or false — are there stunts, locations, or elements requiring special insurance?,
    "distributionPlan": true or false — is the target audience/market clear?,
    "marketingStrategy": true or false — are there marketable hooks, stars, or comparable titles?,
    "legalClearance": true or false — are there IP, rights, or clearance considerations mentioned?
  },
  "team": [
    { "role": "Director", "name": "", "status": "pending", "priority": "high/medium/low", "note": "Why this role is critical for this specific project" },
    { "role": "Producer", "name": "", "status": "pending", "priority": "high/medium/low", "note": "..." },
    { "role": "Cinematographer", "name": "", "status": "pending", "priority": "high/medium/low", "note": "..." },
    { "role": "Production Designer", "name": "", "status": "pending", "priority": "high/medium/low", "note": "..." },
    { "role": "Editor", "name": "", "status": "pending", "priority": "high/medium/low", "note": "..." },
    { "role": "Composer", "name": "", "status": "pending", "priority": "high/medium/low", "note": "..." }
  ],
  "notes": [
    { "category": "casting", "content": "Key casting observation from the document..." },
    { "category": "location", "content": "Location-related production note..." },
    { "category": "budget", "content": "Budget consideration from the document..." },
    { "category": "schedule", "content": "Timeline/scheduling note..." },
    { "category": "team", "content": "Crew/department need based on the document..." },
    { "category": "general", "content": "Any other production-relevant observation..." }
  ]
}

Guidelines:
- For checklist: set true only if the document provides enough information for that item to be actionable.
- For team: always return all 6 roles. Set priority based on what the document reveals about the project's needs. Add a short note explaining why.
- For notes: generate 3-8 notes across different categories. Each note should be a specific, actionable observation from the document — not generic advice. Only include categories where you have something substantive to say.
- Valid note categories: casting, location, budget, schedule, team, general.`;

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

function errorResponse(message: string, origin: string | null, status = 400): Response {
  return jsonResponse({ success: false, error: message }, origin, status);
}

interface AutofillResult {
  checklist: Record<string, boolean>;
  team: Array<{ role: string; name: string; status: string; priority?: string; note?: string }>;
  notes: Array<{ category: string; content: string }>;
}

export async function aiProductionAutofill(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const apiKey = (env as any).ANTHROPIC_API_KEY;
  if (!apiKey) {
    return errorResponse('AI extraction not configured', origin, 503);
  }

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    // Credit check
    const creditRows = await sql`
      SELECT balance FROM user_credits WHERE user_id = ${Number(userId)}
    `.catch(() => []);
    const balance = Number(creditRows[0]?.balance) || 0;

    if (balance < AUTOFILL_CREDIT_COST) {
      return errorResponse(`Insufficient credits. Auto-fill costs ${AUTOFILL_CREDIT_COST} credits. You have ${balance}.`, origin, 402);
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return errorResponse('No file uploaded', origin);
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.txt') && !file.name.endsWith('.docx')) {
      return errorResponse('Only PDF, TXT, and DOCX files are supported', origin);
    }

    // Size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      return errorResponse('File too large. Maximum 10MB.', origin);
    }

    const fileBytes = await file.arrayBuffer();
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    const isTxt = file.type === 'text/plain' || file.name.endsWith('.txt');

    // Build Claude API request content
    let content: any[];

    if (isPdf) {
      const base64 = btoa(String.fromCharCode(...new Uint8Array(fileBytes)));
      content = [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64,
          },
        },
        {
          type: 'text',
          text: AUTOFILL_PROMPT,
        },
      ];
    } else if (isTxt) {
      const text = new TextDecoder().decode(fileBytes);
      content = [
        {
          type: 'text',
          text: `Here is the document content:\n\n${text.substring(0, 100000)}\n\n${AUTOFILL_PROMPT}`,
        },
      ];
    } else {
      // DOCX — basic text extraction
      const text = new TextDecoder('utf-8', { fatal: false }).decode(fileBytes);
      const cleanText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleanText.length < 50) {
        return errorResponse('Could not extract text from document. Try uploading a PDF or TXT file.', origin);
      }
      content = [
        {
          type: 'text',
          text: `Here is the document content:\n\n${cleanText.substring(0, 100000)}\n\n${AUTOFILL_PROMPT}`,
        },
      ];
    }

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errBody);
      return errorResponse('AI analysis failed. Please try again.', origin, 502);
    }

    const claudeData = await claudeResponse.json() as any;
    const responseText = claudeData.content?.[0]?.text || '';

    // Parse the JSON response
    let result: AutofillResult;
    try {
      const jsonStr = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(jsonStr);
    } catch {
      console.error('Failed to parse Claude response:', responseText.substring(0, 500));
      return errorResponse('AI could not extract production data from this document. Try a different file.', origin, 422);
    }

    // Validate structure
    if (!result.checklist || !result.team || !result.notes) {
      return errorResponse('AI returned incomplete data. Please try again.', origin, 422);
    }

    // Deduct credits
    await sql`
      UPDATE user_credits SET balance = balance - ${AUTOFILL_CREDIT_COST}, total_used = total_used + ${AUTOFILL_CREDIT_COST}, last_updated = NOW()
      WHERE user_id = ${Number(userId)}
    `.catch(() => {});

    // Log credit transaction
    await sql`
      INSERT INTO credit_transactions (user_id, type, amount, description, balance_before, balance_after, usage_type, created_at)
      VALUES (${Number(userId)}, 'usage', ${-AUTOFILL_CREDIT_COST}, 'AI production auto-fill', ${balance}, ${balance - AUTOFILL_CREDIT_COST}, 'ai_autofill', NOW())
    `.catch(() => {});

    return jsonResponse({
      success: true,
      data: {
        checklist: result.checklist,
        team: result.team,
        notes: result.notes,
        fileName: file.name,
        fileSize: file.size,
        creditsUsed: AUTOFILL_CREDIT_COST,
        remainingCredits: balance - AUTOFILL_CREDIT_COST,
      },
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('AI production autofill error:', e.message);
    return errorResponse('AI analysis failed unexpectedly', origin, 500);
  }
}
