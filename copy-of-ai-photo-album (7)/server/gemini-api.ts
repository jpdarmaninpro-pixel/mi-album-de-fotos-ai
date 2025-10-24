import { GoogleGenAI, Modality } from "@google/genai";

// Fix: Use environment variable for API key as per security best practices and guidelines.
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("Gemini API key is missing. AI features will be disabled.");
}

// Fix: Conditionally initialize GoogleGenAI to avoid runtime errors if API_KEY is missing.
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

export const editImageWithGemini = async (base64Image: string, prompt: string): Promise<string | null> => {
  // Fix: Check for AI client initialization.
  if (!ai) return null;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
          { text: prompt },
        ],
      },
      config: { responseModalities: [Modality.IMAGE] },
    });

    const firstCandidate = response.candidates?.[0];
    if (firstCandidate?.content?.parts) {
        for (const part of firstCandidate.content.parts) {
            if (part.inlineData?.data) {
                return part.inlineData.data;
            }
        }
    }
    return null;

  } catch (error) {
    console.error("Error editing image with Gemini on the server:", error);
    return null;
  }
};

export const generateAlbumDescriptionWithGemini = async (base64Images: string[]): Promise<{ description: string; keywords: string; }> => {
    // Fix: Check for AI client initialization.
    if (!ai) return { description: "API Key not configured on server.", keywords: "" };
    try {
        const textPart = { text: "You are a professional photographer's assistant. Analyze the following images from a single event. Based on all the images, write a heartfelt, professional album description (2-3 sentences) and suggest 5-7 relevant keywords. Your response should be a single block of text, starting with 'Description:' followed by the description, and then on a new line 'Keywords:' followed by a comma-separated list of keywords." };
        const imageParts = base64Images.map(imgData => ({ inlineData: { mimeType: 'image/jpeg', data: imgData } }));
        const parts = [textPart, ...imageParts];
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: { parts },
            config: { thinkingConfig: { thinkingBudget: 32768 } }
        });
        
        const text = response.text;
        if (!text) {
          return { description: 'AI failed to generate text response.', keywords: '' };
        }

        const descriptionMatch = text.match(/Description:(.*?)Keywords:/s);
        const keywordsMatch = text.match(/Keywords:(.*)/s);
        return {
            description: descriptionMatch ? descriptionMatch[1].trim() : 'Could not generate description.',
            keywords: keywordsMatch ? keywordsMatch[1].trim() : ''
        };
    } catch (error) {
        console.error("Error generating album description on the server:", error);
        return { description: "Error analyzing album images on the server.", keywords: "" };
    }
};

export const generateQRCodeCard = async (photographerName: string, profilePicBase64: string, qrCodeBase64: string, customPrompt?: string): Promise<string | null> => {
  // Fix: Check for AI client initialization.
  if (!ai) return null;
  try {
    const themeInstruction = customPrompt ? `The design style should be: ${customPrompt}.` : "The design style should be modern, elegant, and professional, suitable for a photographer.";
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `Create a beautiful, high-quality promotional card for a photographer named "${photographerName}". This card must prominently feature two images I am providing: 1. The photographer's portrait. 2. A QR code for clients to scan. Arrange these elements artistically. The photographer's name, "${photographerName}", must be clearly legible on the card. The QR code must be clear and scannable. ${themeInstruction} Do not add any other text unless it's purely decorative. The final output must be just the generated image.` },
          { inlineData: { data: profilePicBase64, mimeType: 'image/jpeg' } },
          { inlineData: { data: qrCodeBase64, mimeType: 'image/png' } },
        ],
      },
      config: { responseModalities: [Modality.IMAGE] },
    });
    
    const firstCandidate = response.candidates?.[0];
    if (firstCandidate?.content?.parts) {
        for (const part of firstCandidate.content.parts) {
            if (part.inlineData?.data) {
                return part.inlineData.data;
            }
        }
    }
    return null;

  } catch (error) {
    console.error("Error generating QR code card with Gemini on the server:", error);
    return null;
  }
};