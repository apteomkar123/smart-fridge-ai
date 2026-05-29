const GEMINI_MODEL = 'gemini-2.0-flash';
const HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

const callGemini = async (apiKey, parts, generationConfig = {}) => {
  const geminiParts = parts.map((part) => {
    if (typeof part === 'string') return { text: part };
    return part;
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: geminiParts }],
      generationConfig: { temperature: 0.2, ...generationConfig }
    })
  });

  const responseText = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${responseText.slice(0, 400)}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Gemini response not JSON: ${responseText.slice(0, 200)}`);
  }

  const candidate = data.candidates?.[0]?.content;
  const text = candidate?.parts?.map((p) => p.text).join('') || '';
  if (!text) throw new Error(`Gemini empty response. Full: ${JSON.stringify(data).slice(0, 300)}`);
  return text;
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Missing GEMINI_API_KEY env var' }) };

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

    // Channel B: Recipe generator / ingredient substitution / direct AI prompt
    if (bodyData?.customPrompt) {
      // directMode: pass prompt through untouched — used for structured JSON requests that need exact format
      if (bodyData.directMode) {
        const rawText = await callGemini(apiKey, [{ text: bodyData.customPrompt }], { temperature: 0.4 });
        return { statusCode: 200, headers: HEADERS, body: rawText.replace(/```json/g, '').replace(/```/g, '').trim() };
      }

      const lower = bodyData.customPrompt.toLowerCase();
      const isSubstitution = lower.includes('substitute') || lower.includes('substitution') || lower.includes('swap');
      const isRecipe = !isSubstitution && (lower.includes('recipe') || lower.includes('cook') || lower.includes('meal') || lower.includes('generate'));

      const prompt = isRecipe
        ? `${bodyData.customPrompt}. Generate a creative vegetarian recipe. Return ONLY valid JSON with no extra text and nothing else. Use keys: recipeName, ingredients, steps. Example: { "recipeName": "Veggie Bowl", "ingredients": ["..."], "steps": ["..."] }.`
        : `${bodyData.customPrompt}. Return ONLY valid JSON with no extra text and nothing else. Use one of these keys: substitute, substituteName, recipeName, replacement. Example: { "substitute": "tofu" }.`;

      const rawText = await callGemini(apiKey, [{ text: prompt }], { temperature: 0.7 });
      const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

      return {
        statusCode: 200, headers: HEADERS,
        body: cleanedText
      };
    }

    // Channel C: Receipt image OCR / leftover recognition
    if (bodyData?.image && bodyData.image.trim()) {
      const rawBase64 = bodyData.image.includes(',') ? bodyData.image.split(',')[1] : bodyData.image;

      if (bodyData.leftoverMode) {
        const prompt = 'Look at this food in a container, plate, or bowl. Identify what the prepared food or leftover meal is. Return ONLY valid JSON with no markdown: {"meal":"Leftover Pasta Bolognese"}. Be specific (2-5 words), start with "Leftover" if it looks like a stored meal.';
        const rawText = await callGemini(apiKey, [{ text: prompt }, { inlineData: { data: rawBase64, mimeType: 'image/jpeg' } }], { temperature: 0.3 });
        let meal = 'Prepared Meal';
        try {
          const p = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
          meal = p.meal || meal;
        } catch {
          meal = rawText.replace(/['"#*`\n{}:]/g, '').trim().split(',')[0] || meal;
        }
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true, meal }) };
      }

      const prompt = 'Read this receipt image. Return ONLY a JSON object: { "storeName": "string", "items": ["array of food item strings"] }. No markdown, no explanation.';
      const rawText = await callGemini(
        apiKey,
        [{ text: prompt }, { inlineData: { data: rawBase64, mimeType: 'image/jpeg' } }],
        { temperature: 0.1 }
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
