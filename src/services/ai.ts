import { Creator, InviteMessage, AI_PROVIDERS } from '@/types';
import { getSettings } from '@/utils/storage';

interface AIResponse {
  success: boolean;
  content?: string;
  error?: string;
}

async function callAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<AIResponse> {
  const settings = await getSettings();

  if (!settings.apiKey) {
    return { success: false, error: 'API Key not configured. Go to Settings to add your key.' };
  }

  const provider = AI_PROVIDERS[settings.aiProvider] || AI_PROVIDERS.openai;
  const apiUrl = settings.aiProvider === 'custom'
    ? (settings.customApiUrl || '')
    : provider.apiUrl;
  const model = settings.aiModel || provider.defaultModel;

  if (!apiUrl) {
    return { success: false, error: 'API URL not configured. Set a custom API URL in Settings.' };
  }

  try {
    // All supported providers use OpenAI-compatible format
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    let data: any;
    try {
      data = await response.json();
    } catch {
      return { success: false, error: `API returned non-JSON response (HTTP ${response.status})` };
    }
    console.log('[ShopPilot] API response:', JSON.stringify(data).substring(0, 500));

    // Check for MiniMax-style error (base_resp with non-zero status_code)
    if (data.base_resp && data.base_resp.status_code !== 0) {
      return { success: false, error: `API error: ${data.base_resp.status_msg || 'Unknown error'} (code ${data.base_resp.status_code})` };
    }

    if (!response.ok) {
      const errorMsg = data.error?.message || data.base_resp?.status_msg || `API error: ${response.status}`;
      return { success: false, error: errorMsg };
    }

    const msg = data.choices?.[0]?.message;
    // MiniMax reasoning models put output in reasoning_content when content is empty
    const content = msg?.content || msg?.reasoning_content || '';
    if (!content) {
      return { success: false, error: `AI returned empty content. Check your API key and model settings.` };
    }
    return { success: true, content };
  } catch (err) {
    return { success: false, error: `Network error: ${(err as Error).message}` };
  }
}

// ---- Generate Creator Invitation ----

export async function generateInviteMessage(
  creator: Creator,
  tone: 'professional' | 'casual' | 'friendly' = 'professional',
  productInfo?: string
): Promise<InviteMessage | { error: string }> {
  const systemPrompt = `You are an expert TikTok Shop seller writing personalized collaboration invitations to content creators. 

Rules:
- Write in English
- Keep it concise (under 150 words)
- Mention the creator's name and relevant stats naturally
- Include a clear value proposition (commission rate, free samples, etc.)
- End with a clear call-to-action
- Tone: ${tone}
- Do NOT use generic templates. Each message should feel unique and personal.

Output format: Return ONLY the message body, no subject line or metadata.`;

  const userPrompt = `Write a collaboration invitation for this TikTok creator:

Name: ${creator.displayName} (@${creator.username})
Followers: ${formatNumber(creator.followerCount)}
Categories: ${creator.categories.join(', ')}
30-day GMV: $${creator.gmv30d.toLocaleString()}
Items sold (30d): ${creator.itemsSold30d}
${productInfo ? `\nProduct to promote: ${productInfo}` : ''}

Generate a ${tone} invitation message.`;

  const result = await callAI(systemPrompt, userPrompt);

  if (!result.success) {
    return { error: result.error || 'Failed to generate message' };
  }

  return {
    id: crypto.randomUUID(),
    creatorId: creator.id,
    subject: `Collaboration Opportunity with ${creator.displayName}`,
    body: result.content!,
    tone,
    generatedAt: Date.now(),
    sent: false,
  };
}

// ---- Generate Product Listing Copy ----

export async function generateListingCopy(
  productInfo: string,
  language: string = 'en'
): Promise<{ title: string; description: string; bulletPoints: string[]; seoTags: string[] } | { error: string }> {
  const systemPrompt = `You are a TikTok Shop listing optimization expert. Generate compelling product listings that maximize visibility and conversion.

Rules:
- Language: ${language === 'zh' ? 'Chinese (Simplified)' : 'English'}
- Title: Under 100 characters, include key search terms
- Description: 200-300 words, persuasive and benefit-focused
- Bullet points: 5 key selling points
- SEO tags: 10 relevant search tags for TikTok Shop

Output in JSON format:
{
  "title": "...",
  "description": "...",
  "bulletPoints": ["...", "..."],
  "seoTags": ["...", "..."]
}`;

  const result = await callAI(systemPrompt, `Product info: ${productInfo}`);

  if (!result.success) {
    return { error: result.error || 'Failed to generate listing' };
  }

  try {
    const raw = result.content!;
    console.log('[ShopPilot] AI raw response:', raw);

    // Strategy 1: Extract JSON from markdown code blocks
    const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim());
    }

    // Strategy 2: Find first { ... } block in the response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Strategy 3: Try parsing the whole response as JSON
    return JSON.parse(raw.trim());
  } catch (e) {
    console.error('[ShopPilot] Parse error:', e, '\nRaw content:', result.content);
    return { error: `Failed to parse AI response. Raw: ${result.content?.substring(0, 200)}` };
  }
}

// ---- Utility ----

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}
