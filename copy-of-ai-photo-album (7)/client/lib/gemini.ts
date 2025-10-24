// This file is now responsible for making API calls to OUR backend,
// which will then securely call the Gemini API.

/**
 * Edits an image by sending a request to our backend server.
 * @param base64Image The base64 encoded image data.
 * @param prompt The user's text prompt for editing.
 * @returns A new base64 encoded image string.
 */
export const editImageWithGemini = async (base64Image: string, prompt: string): Promise<string | null> => {
  try {
    const response = await fetch('/api/edit-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base64Image, prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Backend server responded with an error.');
    }

    const { base64Image: newBase64Image } = await response.json();
    return newBase64Image;

  } catch (error) {
    console.error("Error calling backend for image editing:", error);
    return null;
  }
};


/**
 * Generates an album description by calling our backend server.
 * @param base64Images An array of base64 encoded image data.
 * @returns An object with description and keywords.
 */
export const generateAlbumDescriptionWithGemini = async (base64Images: string[]): Promise<{ description: string; keywords: string; }> => {
    try {
        const response = await fetch('/api/generate-description', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ base64Images }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Backend server responded with an error.');
        }

        return await response.json();

    } catch (error) {
        console.error("Error calling backend for album description:", error);
        return { description: "Error analyzing album images via backend.", keywords: "" };
    }
};

/**
 * Generates a promotional card with a QR code by calling our backend server.
 * @param photographerName The name of the photographer.
 * @param profilePicBase64 The base64 encoded profile picture.
 * @param qrCodeBase64 The base64 encoded QR code image.
 * @param customPrompt An optional user-provided prompt for styling.
 * @returns A new base64 encoded image string for the card.
 */
export const generateQRCodeCard = async (
  photographerName: string,
  profilePicBase64: string,
  qrCodeBase64: string,
  customPrompt?: string
): Promise<string | null> => {
  try {
    const response = await fetch('/api/generate-qr-card', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        photographerName,
        profilePicBase64,
        qrCodeBase64,
        customPrompt,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Backend server responded with an error.');
    }

    const { base64Image } = await response.json();
    return base64Image;
    
  } catch (error) {
    console.error("Error calling backend for QR card generation:", error);
    return null;
  }
};