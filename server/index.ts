// Fix: Use fully qualified express Request and Response types to resolve conflicts with global types.
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { 
    editImageWithGemini, 
    generateAlbumDescriptionWithGemini, 
    generateQRCodeCard 
} from './gemini-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file only in development
if (process.env.NODE_ENV !== 'production') {
  // Correctly locate the .env file at the project root from the compiled /dist folder
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  dotenv.config({ path: envPath });
}


const app = express();
// Render provides the PORT environment variable for deployment
const port = process.env.PORT || 3001;
// Bind to 0.0.0.0 to accept connections from outside the container, which is required by Render
const host = '0.0.0.0';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
// Fix: Use fully qualified express.Request and express.Response types to resolve type errors.
app.post('/api/edit-image', async (req: express.Request, res: express.Response) => {
    const { base64Image, prompt } = req.body;
    if (!base64Image || !prompt) {
        return res.status(400).json({ error: 'Missing base64Image or prompt' });
    }
    try {
        const result = await editImageWithGemini(base64Image, prompt);
        if (result) {
            res.json({ base64Image: result });
        } else {
            res.status(500).json({ error: 'Failed to edit image with AI' });
        }
    } catch (error) {
        console.error('Error in /api/edit-image:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fix: Use fully qualified express.Request and express.Response types to resolve type errors.
app.post('/api/generate-description', async (req: express.Request, res: express.Response) => {
    const { base64Images } = req.body;
    if (!base64Images || !Array.isArray(base64Images)) {
        return res.status(400).json({ error: 'Missing base64Images array' });
    }
    try {
        const result = await generateAlbumDescriptionWithGemini(base64Images);
        res.json(result);
    } catch (error) {
        console.error('Error in /api/generate-description:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fix: Use fully qualified express.Request and express.Response types to resolve type errors.
app.post('/api/generate-qr-card', async (req: express.Request, res: express.Response) => {
    const { photographerName, profilePicBase64, qrCodeBase64, customPrompt } = req.body;
    if (!photographerName || !profilePicBase64 || !qrCodeBase64) {
        return res.status(400).json({ error: 'Missing required parameters for QR card generation' });
    }
    try {
        const result = await generateQRCodeCard(photographerName, profilePicBase64, qrCodeBase64, customPrompt);
        if (result) {
            res.json({ base64Image: result });
        } else {
            res.status(500).json({ error: 'Failed to generate QR card with AI' });
        }
    } catch (error) {
        console.error('Error in /api/generate-qr-card:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve frontend static files
const clientBuildPath = path.join(__dirname, 'public');

app.use(express.static(clientBuildPath));

// Catch-all route to serve index.html for client-side routing
// Fix: Use fully qualified express.Request and express.Response types to resolve type errors.
app.get('*', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});


// Start the server, listening on the correct host and port
app.listen(Number(port), host, () => {
    // A more production-friendly log message
    console.log(`[server]: Server listening on port ${port}`);
});