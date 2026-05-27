const GEMINI_MODEL = 'gemini-2.0-flash';
const HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

const callGemini = async (apiKey, parts, generationConfig = {}) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.2, ...generationConfig }
    })
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini ${res.status}: ${errBody.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Missing API key' }) };

    const bodyData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    // Channel A: Item name sanitizer
    if (bodyData?.resolveItemToken) {
      const storeContext = bodyData.storeContext || 'Grocery Store';
      const prompt = `Analyze this raw receipt entry: "${bodyData.resolveItemToken}" bought at "${storeContext}". Isolate what the food item is as a single core singular common noun matching standard recipe terms. Strip weights, pack sizing numbers, brand names, and qualifiers. Return ONLY the plain text word noun. Examples: "Organic Brown Eggs 12ct" -> "egg", "sliced provolone cheese 8oz" -> "provolone cheese".`;
      const text = await callGemini(apiKey, [{ text: prompt }], { temperature: 0.1 });
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
        ? `${bodyData.customPrompt}. Generate a creative vegetarian recipe. Return ONLY valid JSON with no extra text: { "recipeName": "string", "ingredients": ["string"], "steps": ["string"] }.`
        : `${bodyData.customPrompt}. Return ONLY valid JSON with no extra text: { "recipeName": "substitute_name_here" }.`;

      const rawText = await callGemini(apiKey, [{ text: prompt }], {
        temperature: 0.2,
        responseMimeType: 'application/json'
      });

      return {
        statusCode: 200, headers: HEADERS,
        body: rawText.replace(/```json/g, '').replace(/```/g, '').trim()
      };
    }

    // Channel C: Receipt image OCR
    if (bodyData?.image && bodyData.image.trim()) {
      const rawBase64 = bodyData.image.includes(',') ? bodyData.image.split(',')[1] : bodyData.image;
      const prompt = 'Read this receipt image. Return ONLY a JSON object: { "storeName": "string", "items": ["array of food item strings"] }. No markdown, no explanation.';
      const rawText = await callGemini(
        apiKey,
        [{ text: prompt }, { inlineData: { data: rawBase64, mimeType: 'image/jpeg' } }],
        { temperature: 0.1, responseMimeType: 'application/json' }
      );

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
