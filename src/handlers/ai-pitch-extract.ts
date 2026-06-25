/**
 * AI Pitch Extraction Handler
 * Accepts a PDF upload, sends it to Claude API, returns structured pitch data.
 * Costs 5 credits per extraction.
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';
import { observedSwallow, safeQuery } from '../db/safe-query';

const AI_EXTRACT_CREDIT_COST = 5;

const EXTRACTION_PROMPT = `You are analyzing a film/TV document (script, treatment, pitch deck, or synopsis) to extract structured pitch data for a movie pitch platform.

Extract as many of the following fields as you can from the document. Return ONLY valid JSON with no markdown formatting, no code blocks, no explanation — just the JSON object.

{
  "title": "The title of the project",
  "logline": "A 1-2 sentence hook that captures the essence of the story",
  "genre": "Primary genre (e.g. Drama, Comedy, Thriller, Horror, Sci-Fi, Action, Romance, Documentary)",
  "format": "Format type (e.g. Feature Film, TV Series, Short Film, Limited Series, Documentary)",
  "shortSynopsis": "A 2-3 paragraph synopsis covering the main story arc",
  "themes": ["Array of thematic elements"],
  "characters": [
    {
      "name": "Character name",
      "description": "Brief character description and role in the story",
      "age": "Approximate age or age range",
      "gender": "Character gender"
    }
  ],
  "targetAudience": "Who this project is for (age group, interests)",
  "toneAndStyle": "The tone and visual/narrative style",
  "comparableFilms": "2-3 comparable films or shows (e.g. 'Inception meets The Social Network')",
  "budgetRange": "Estimated budget tier based on scope: Micro (<$100K), Low ($100K-$1M), Medium ($1M-$10M), High ($10M-$50M), Blockbuster ($50M+)",
  "worldDescription": "Setting and world of the story",
  "productionTimeline": "Suggested timeline based on project scope"
}

If a field cannot be determined from the document, omit it from the response. For characters, include up to 6 main characters. For the logline, make it compelling and industry-standard.`;

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

function errorResponse(message: string, origin: string | null, status = 400): Response {
  return jsonResponse({ success: false, error: message }, origin, status);
}

/**
 * Base64-encode an ArrayBuffer in fixed-size chunks. Spreading a whole multi-MB
 * Uint8Array into `String.fromCharCode(...bytes)` blows the argument/call-stack
 * limit ("Maximum call stack size exceeded") for anything but tiny files — which
 * 500'd this handler on real-world PDFs. 32KB chunks stay well under the limit.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000; // 32768
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(binary);
}

export async function aiPitchExtract(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  // Check for API key
  const apiKey = (env as any).ANTHROPIC_API_KEY;
  if (!apiKey) {
    return errorResponse('AI extraction not configured', origin, 503);
  }

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    // Credit check — gate-feeding. Fail closed on credit-table outage AND surface to Sentry.
    const creditRows = await safeQuery<{ balance: number | string }>(() => sql`
      SELECT balance FROM user_credits WHERE user_id = ${userId}
    `, { fallback: [], context: 'ai-pitch-extract.credit-check' });

    if (!creditRows.ok) {
      return errorResponse('Credit check temporarily unavailable. Please retry.', origin, 503);
    }
    const balance = Number(creditRows.rows[0]?.balance) || 0;

    if (balance < AI_EXTRACT_CREDIT_COST) {
      return errorResponse(`Insufficient credits. AI extraction costs ${AI_EXTRACT_CREDIT_COST} credits. You have ${balance}.`, origin, 402);
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

    // Build Claude API request
    let content: any[];

    if (isPdf) {
      // Send PDF directly to Claude using document type
      const base64 = arrayBufferToBase64(fileBytes);
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
          text: EXTRACTION_PROMPT,
        },
      ];
    } else if (isTxt) {
      // Plain text — send as text
      const text = new TextDecoder().decode(fileBytes);
      content = [
        {
          type: 'text',
          text: `Here is the document content:\n\n${text.substring(0, 100000)}\n\n${EXTRACTION_PROMPT}`,
        },
      ];
    } else {
      // DOCX — try to extract as text (basic approach)
      const text = new TextDecoder('utf-8', { fatal: false }).decode(fileBytes);
      // Extract readable text from DOCX XML
      const cleanText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleanText.length < 50) {
        return errorResponse('Could not extract text from document. Try uploading a PDF or TXT file.', origin);
      }
      content = [
        {
          type: 'text',
          text: `Here is the document content:\n\n${cleanText.substring(0, 100000)}\n\n${EXTRACTION_PROMPT}`,
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
      return errorResponse('AI extraction failed. Please try again.', origin, 502);
    }

    const claudeData = await claudeResponse.json() as any;
    const responseText = claudeData.content?.[0]?.text || '';

    // Parse the JSON response
    let extractedData: Record<string, unknown>;
    try {
      // Handle potential markdown code blocks
      const jsonStr = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extractedData = JSON.parse(jsonStr);
    } catch {
      console.error('Failed to parse Claude response:', responseText.substring(0, 500));
      return errorResponse('AI could not extract structured data from this document. Try a different file.', origin, 422);
    }

    // Deduct credits + log transaction. Best-effort writes — AI response already
    // returned to user; failures surface in Sentry as revenue/audit leakage.
    await observedSwallow(
      () => sql`
        UPDATE user_credits SET balance = balance - ${AI_EXTRACT_CREDIT_COST}, total_used = total_used + ${AI_EXTRACT_CREDIT_COST}, last_updated = NOW()
        WHERE user_id = ${userId}
      `,
      'ai-pitch-extract.credit-deduction',
    );

    await observedSwallow(
      () => sql`
        INSERT INTO credit_transactions (user_id, type, amount, description, balance_before, balance_after, usage_type, created_at)
        VALUES (${userId}, 'usage', ${-AI_EXTRACT_CREDIT_COST}, 'AI pitch extraction', ${balance}, ${balance - AI_EXTRACT_CREDIT_COST}, 'ai_extract', NOW())
      `,
      'ai-pitch-extract.transaction-log',
    );

    return jsonResponse({
      success: true,
      data: {
        extracted: extractedData,
        fileName: file.name,
        fileSize: file.size,
        creditsUsed: AI_EXTRACT_CREDIT_COST,
        remainingCredits: balance - AI_EXTRACT_CREDIT_COST,
      },
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('AI pitch extraction error:', e.message);
    return errorResponse('AI extraction failed unexpectedly', origin, 500);
  }
}
