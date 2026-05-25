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
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing Gemini Key' }) };
    }

    const ai = new GoogleGenAI({ apiKey });
    const bodyData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    // PIPELINE ROUTE A: AI Custom Recipe Generator
    if (bodyData && bodyData.customPrompt) {
      const optimizedPrompt = `${bodyData.customPrompt} 
      Select a highly cohesive, delicious subset of 3 to 6 matching ingredients from your available stocks to build a dish. 
      Ensure every single element listed in your ingredients array output is explicitly used and referenced with concrete instructions within your steps array.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: optimizedPrompt,
        config: {
          temperature: 0.7,
          responseMimeType: "application/json",
          // FIX: Corrected property parameter option name explicitly to enforce SDK structured schemas
          responseJsonSchema: {
            type: "OBJECT",
            properties: {
              recipeName: { type: "STRING" },
              prepTime: { type: "STRING" },
              ingredients: { type: "ARRAY", items: { type: "STRING" } },
              steps: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["recipeName", "prepTime", "ingredients", "steps"]
          }
        }
      });

      return {
        statusCode: 200,
        headers: { 
          "Content-Type": "application/json", 
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type"
        },
        body: response.text
      };
    }

    // PIPELINE ROUTE B: Optical Receipt Vision Processing
    if (!bodyData || !bodyData.image) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing image payload' }) };
    }
    
    let rawBase64 = bodyData.image.includes(',') ? bodyData.image.split(',')[1] : bodyData.image;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        "Analyze this grocery receipt. Extract merchant name and list all food items strictly as a raw JSON array of strings: [\"Item1\", \"Item2\"]. Do not wrap in markdown text wrappers.",
        { inlineData: { data: rawBase64, mimeType: "image/jpeg" } }
      ],
      config: { temperature: 0.1 }
    });

    const returnedText = response.text.trim();
    const match = returnedText.match(/\[([\s\S]*?)\]/);

    if (!match) {
      return { statusCode: 422, body: JSON.stringify({ error: "Could not isolate a structural JSON array." }) };
    }

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: JSON.stringify({ success: true, added: JSON.parse(match[0]) }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Backend crash: ${error.message}` }),
    };
  }
};