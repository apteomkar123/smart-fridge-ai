import { GoogleGenAI } from '@google/genai';

export const handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing Gemini Key' }) };
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const bodyData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    let rawBase64 = bodyData.image.includes(',') ? bodyData.image.split(',')[1] : bodyData.image;

    const imagePart = {
      inlineData: {
        data: rawBase64,
        mimeType: "image/jpeg"
      },
    };

    const prompt = `You are a precise grocery receipt parsing engine. Analyze this image step-by-step:
1. Scan the top header area to identify the retail store name (e.g., Trader Joe's).
2. Read the purchased goods line-by-line, ignoring prices, quantities, savings, or subtotals.
3. Decode any shorthand descriptions into clean, plain English singular ingredient names (e.g., "LENTIL RINGS SOUR CREAM" to "Lentils", "CREAMER OAT BROWN SUGAR" to "Oat Milk", "SOURDOUGH BREAD" to "Sourdough Bread").

Return the final list of clean ingredients strictly as a JSON array of strings, like this: ["Lentils", "Oat Milk", "Sourdough Bread"]. 
Do not include markdown code block syntax formatting or conversational prose.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [prompt, imagePart],
      config: {
        temperature: 0.1
      }
    });

    const returnedText = response.text.trim();
    console.log("Raw Gemini Output:", returnedText); // Log to Netlify dashboard for tracing

    // BULLETPROOF REGEX: Match everything inside and including the outer square brackets [ ... ]
    const arrayRegex = /\[([\s\S]*?)\]/;
    const match = returnedText.match(arrayRegex);

    if (!match) {
      return {
        statusCode: 422,
        body: JSON.stringify({ error: "Could not isolate a structural JSON array from the response layout.", raw: returnedText })
      };
    }

    // Parse the matched array string natively
    const cleanIngredients = JSON.parse(match[0]);

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      },
      body: JSON.stringify({ success: true, added: cleanIngredients }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Receipt extraction pipeline crash: ${error.message}` }),
    };
  }
};