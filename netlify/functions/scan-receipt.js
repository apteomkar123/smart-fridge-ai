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

    // ... (keep the API key and setup lines at the top the same)

let rawBase64 = "";

try {
  // Handle both stringified JSON and pre-parsed object bodies gracefully
  const bodyData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  
  if (bodyData && bodyData.image) {
    // If it includes the metadata prefix (e.g., "data:image/jpeg;base64,"), strip it
    rawBase64 = bodyData.image.includes(',') ? bodyData.image.split(',')[1] : bodyData.image;
  } else {
    // Fallback if the body itself is just the raw data string
    rawBase64 = event.body.includes(',') ? event.body.split(',')[1] : event.body;
  }
} catch (e) {
  // If JSON parsing fails entirely, treat the raw body string as the data target
  rawBase64 = event.body.includes(',') ? event.body.split(',')[1] : event.body;
}

// Ensure we actually have data before continuing
if (!rawBase64) {
  return {
    statusCode: 400,
    body: JSON.stringify({ error: "Missing image data payload in request body." })
  };
}

const imagePart = {
  inlineData: {
    data: rawBase64,
    mimeType: "image/jpeg"
  },
};

// ... (keep the rest of your prompt and ai.models.generateContent code the same)
    
    // Safely parse the Base64 data string out of the incoming request body
    const bodyData = JSON.parse(event.body);
    const rawBase64 = bodyData.image.split(',')[1]; // Strips out the metadata prefix (e.g., "data:image/jpeg;base64,")

    const imagePart = {
      inlineData: {
        data: rawBase64,
        mimeType: "image/jpeg"
      },
    };

    const prompt = `Analyze this grocery receipt picture step-by-step:
1. Scan the very top header area of the image to identify the merchant/store name (e.g., Trader Joe's, Harris Teeter, Food Lion, Target, Walmart, Whole Foods, etc.).
2. Extract each individual item row purchased from the receipt.
3. For each extracted line item, perform a contextual query combining the store name and the item abbreviation to determine the clean, raw, singular ingredient name (e.g., if the line says 'TJ ORG CHK' from 'Trader Joe's', search or resolve this to 'Chicken').
4. Strip away pricing, transactional metadata, or store specific internal SKUs.

Return the final results STRICTLY as a raw JSON array of strings containing only the clean, plain English ingredient names: ["Chicken", "Garlic", "Avocado"]. Do not include markdown code blocks, do not include prose, and ensure it is valid parsable JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [prompt, imagePart],
      config: {
        tools: [{ googleSearch: {} }], // Keeps real-time web verification active
        temperature: 1.0
      }
    });

    const cleanJsonString = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const cleanIngredients = JSON.parse(cleanJsonString);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, added: cleanIngredients }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Parsing and grounding failure: ${error.message}` }),
    };
  }
};