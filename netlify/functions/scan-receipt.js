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
    
    // Parse the image format payload coming from client processing blocks
    const base64Image = event.isBase64Encoded 
      ? event.body 
      : Buffer.from(event.body).toString('base64');

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: "image/jpeg"
      },
    };

    const prompt = `Analyze this grocery receipt picture. Extract only the distinct raw food ingredients, meats, condiments, or produce purchased. 
Clean up chaotic retail checkout abbreviations into plain, clear English item names (e.g., transform 'CHKN BRST' or 'ORG CHK BRST' to 'Chicken Breast', and 'ORNGS 3LB' to 'Oranges'). 
Return the result STRICTLY as a raw JSON array of strings like ["Chicken Breast", "Garlic", "Oranges"]. 
Do not wrap it in markdown code blocks, do not include prose, and do not include pricing.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [prompt, imagePart],
    });

    // Strip markdown formatting safeguards if present
    const cleanJsonString = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const newItems = JSON.parse(cleanJsonString);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, added: newItems }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Processing failure: ${error.message}` }),
    };
  }
};