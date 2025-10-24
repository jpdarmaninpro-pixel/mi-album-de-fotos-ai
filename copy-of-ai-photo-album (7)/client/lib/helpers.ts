export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result as string;
            // remove the data URL prefix
            resolve(base64data.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const urlToBase64 = async (url: string): Promise<string> => {
    // Use a proxy to avoid CORS issues if necessary, but direct fetch should work for public Google Drive links
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image from url: ${url}. Status: ${response.statusText}`);
    }
    const blob = await response.blob();
    return blobToBase64(blob);
};

export const urlToFile = async (url: string, filename: string, mimeType?: string): Promise<File> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch file from url: ${url}. Status: ${response.statusText}`);
    }
    const blob = await response.blob();
    const resolvedMimeType = mimeType || blob.type;
    return new File([blob], filename, { type: resolvedMimeType });
};