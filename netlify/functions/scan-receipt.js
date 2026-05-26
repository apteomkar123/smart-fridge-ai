import { GoogleGenAI } from '@google/genai';

export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'Missing API Key Mapping' }) };

    const ai = new GoogleGenAI({ apiKey });
    const bodyData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    // 1. CHANNELS GATE A: Inline Lookup Sanitizer
    if (bodyData && bodyData.resolveItemToken) {
      const storeContext = bodyData.storeContext || 'Grocery Store';
      const prompt = `Analyze this raw receipt entry: "${bodyData.resolveItemToken}" bought at "${storeContext}". Isolate what the food item is as a single core singular common noun matching standard recipe terms. Strip weights, pack sizing numbers, brand names, and qualifiers. Return ONLY the plain text word noun. Examples: "Organic Brown Eggs 12ct" -> "egg", "sliced provolone cheese 8oz" -> "provolone cheese".`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { temperature: 0.1 }
      });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ sanitized: response.text.trim().toLowerCase() })
      };
    }

    // 2. CHANNELS GATE B: AI Recipe Generator Core Integration
    if (bodyData && bodyData.customPrompt) {
      const prompt = `${bodyData.customPrompt} Formulate a creative vegetarian recipe using these items. You must respond with a strict raw JSON object string mapping exactly these properties: { "recipeName": "string name", "ingredients": ["clean item strings"], "steps": ["step 1 description string", "step 2 description string"] }. Do not wrap inside markdown code block formatting backticks.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { temperature: 0.2 }
      });

      const cleanJsonString = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: cleanJsonString
      };
    }

    // 3. CHANNELS GATE C: Standard Base64 Image Receipt Processing OCR Matrix
    if (bodyData && bodyData.image && bodyData.image.trim() !== "") {
      let rawBase64 = bodyData.image.includes(',') ? bodyData.image.split(',')[1] : bodyData.image;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          "Compile all purchased grocery line items from this receipt as a single flat raw JSON array of text strings. Example: [\"eggs\", \"milk\"]. No extra words or wrapping markdown wrappers.",
          { inlineData: { data: rawBase64, mimeType: "image/jpeg" } }
        ],
        config: { temperature: 0.1 }
      });

      const parsedText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ success: true, added: JSON.parse(parsedText) })
      };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Malformed payload mapping variables' }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};