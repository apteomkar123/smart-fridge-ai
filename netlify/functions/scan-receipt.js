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

    // INTERACTIVE ROUTING: If the request is an AI Recipe Generation request
    if (bodyData && bodyData.customPrompt) {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: bodyData.customPrompt,
        config: {
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              recipeName: { type: "STRING" },
              prepTime: { type: "STRING" },
              steps: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["recipeName", "prepTime", "steps"]
          }
        }
      });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: response.text
      };
    }

    // STANDARD ROUTING: Fallback to standard base64 receipt scanning
    if (!bodyData || !bodyData.image) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing image or custom prompt payload' }) };
    }
    
    let rawBase64 = bodyData.image.includes(',') ? bodyData.image.split(',')[1] : bodyData.image;

    const imagePart = {
      inlineData: {
        data: rawBase64,
        mimeType: "image/jpeg"
      },
    };

    const prompt = `Analyze this grocery receipt image. Identify the merchant store name and list all purchased food items. Return the clean food item names strictly as a JSON array of strings: ["Item1", "Item2"]. Do not include markdown code block formatting ticks.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [prompt, imagePart],
      config: { temperature: 0.1 }
    });

    const returnedText = response.text.trim();
    const arrayRegex = /\[([\s\S]*?)\]/;
    const match = returnedText.match(arrayRegex);

    if (!match) {
      return { statusCode: 422, body: JSON.stringify({ error: "Could not isolate JSON array from vision response." }) };
    }

    const cleanIngredients = JSON.parse(match[0]);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true, added: cleanIngredients }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Backend pipeline crash: ${error.message}` }),
    };
  }
};