import { GoogleGenAI, createPartFromBase64, createUserContent } from '@google/genai';

const GEMINI_MODEL = 'gemini-2.0-flash';
const HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Missing GEMINI_API_KEY' }) };

    const ai = new GoogleGenAI({ apiKey });
    const bodyData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    // Channel A: Item name sanitizer
    if (bodyData?.resolveItemToken) {
      const storeContext = bodyData.storeContext || 'Grocery Store';
      const prompt = `Analyze this raw receipt entry: "${bodyData.resolveItemToken}" bought at "${storeContext}". Isolate what the food item is as a single core singular common noun matching standard recipe terms. Strip weights, pack sizing numbers, brand names, and qualifiers. Return ONLY the plain text word noun. Examples: "Organic Brown Eggs 12ct" -> "egg", "sliced provolone cheese 8oz" -> "provolone cheese".`;
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { temperature: 0.1 }
      });
      const text = response.text || '';
      return {
        statusCode: 200, headers: HEADERS,
        body: JSON.stringify({ sanitized: text.replace(/["'#*`\n]/g, '').trim().toLowerCase() })
      };
    }

    // Channel B: Recipe generator / ingredient substitution
    if (bodyData?.customPrompt) {
      const lower = bodyData.customPrompt.toLowerCase();
      const isSubstitution = lower.includes('substitute') || lower.includes('substitution') || lower.includes('swap');
      const isRecipe = !isSubstitution && (lower.includes('recipe') || lower.includes('cook') || lower.includes('meal') || lower.includes('generate'));

      const prompt = isRecipe
        ? `${bodyData.customPrompt}. Generate a creative vegetarian recipe. Return ONLY valid JSON with no extra text and nothing else. Use keys: recipeName, ingredients, steps. Example: { "recipeName": "Veggie Bowl", "ingredients": ["..."], "steps": ["..."] }.`
        : `${bodyData.customPrompt}. Return ONLY valid JSON with no extra text and nothing else. Use one of these keys: substitute, substituteName, recipeName, replacement. Example: { "substitute": "tofu" }.`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { temperature: 0.7 }
      });
      const rawText = response.text || '';
      const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

      return {
        statusCode: 200, headers: HEADERS,
        body: cleanedText
      };
    }

    // Channel C: Receipt image OCR
    if (bodyData?.image && bodyData.image.trim()) {
      const rawBase64 = bodyData.image.includes(',') ? bodyData.image.split(',')[1] : bodyData.image;
      const prompt = 'Read this receipt image. Return ONLY a JSON object: { "storeName": "string", "items": ["array of food item strings"] }. No markdown, no explanation.';

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: createUserContent([
          prompt,
          createPartFromBase64(rawBase64, 'image/jpeg')
        ]),
        config: { temperature: 0.1 }
      });
      const rawText = response.text || '';

      let result = { storeName: 'General Grocery', items: [] };
      try {
        result = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
      } catch (e) {
        const m = rawText.match(/\[[\s\S]*?\]/);
        if (m) try { result.items = JSON.parse(m[0]); } catch (_) {}
      }

      return {
        statusCode: 200, headers: HEADERS,
        body: JSON.stringify({ success: true, added: Array.isArray(result.items) ? result.items : [], storeName: result.storeName || 'General Grocery' })
      };
    }

    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Malformed request' }) };
  } catch (error) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: error.message }) };
  }
};
