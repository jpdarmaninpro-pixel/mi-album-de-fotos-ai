// Fix: Changed express import and type references to use the `express.` prefix
// (e.g., `express.Request`, `express.Response`). This resolves TypeScript errors
// caused by type conflicts or incorrect type resolution for Express objects.
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

// Fix: Define __dirname at the top to use for path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
// Fix: Use __dirname to resolve path to .env file, avoiding process.cwd() type error.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app: express.Express = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
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
const clientBuildPath = path.join(__dirname, '..', 'client/dist');

app.use(express.static(clientBuildPath));

// Catch-all route to serve index.html for client-side routing
app.get('*', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});


app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});
