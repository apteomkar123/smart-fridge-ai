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
    if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'Missing API Key' }) };

    const ai = new GoogleGenAI({ apiKey });
    const bodyData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    // INTERNET PARSING ENGINE SIMULATION: Resolves item names semantically using store lookup data
    if (bodyData && bodyData.resolveItemToken) {
      const storeContext = bodyData.storeContext || 'Grocery Store';
      const prompt = `You are a food product intelligence scanner looking up inventory entries.
      Analyze this raw receipt item text string: "${bodyData.resolveItemToken}" purchased from "${storeContext}".
      Parse out packaging units, loose numbers, weights, sizes, pack descriptions, and descriptive qualifiers.
      Isolate exactly what the product is as a single core singular food noun matching standard recipe terminology.
      Examples:
      - "organic croissants 3 pack" -> "croissant"
      - "eggs large brown pasture raised 12ct" -> "egg"
      - "boars head premium sliced provolone cheese" -> "provolone cheese"
      - "chiquita bananas organic bundle" -> "banana"
      
      Respond with ONLY the plain parsed matching singular noun string. No punctuation, no wrapping, no extra words.`;

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

    // Standard receipt OCR image scanning loop remains intact below...
    if (bodyData && bodyData.image) {
      let rawBase64 = bodyData.image.includes(',') ? bodyData.image.split(',')[1] : bodyData.image;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          "Analyze this receipt photo. Extract the merchant name if visible, and compile all purchased food line items as a raw JSON array of clean strings. Example: [\"eggs large\", \"croissants\"].",
          { inlineData: { data: rawBase64, mimeType: "image/jpeg" } }
        ],
        config: { temperature: 0.1 }
      });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ success: true, added: JSON.parse(response.text.match(/\[([\s\S]*?)\]/)[0]) })
      };
    }

    return { statusCode: 400, body: 'Malformed request matrix' };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};