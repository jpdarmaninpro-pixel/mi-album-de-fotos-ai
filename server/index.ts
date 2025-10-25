
import express, { Request as ExpressRequest, Response as ExpressResponse, NextFunction as ExpressNextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { 
    editImageWithGemini, 
    generateAlbumDescriptionWithGemini, 
    generateQRCodeCard 
} from './gemini-api.js';
import { getS3Object, putS3Object, generatePresignedPutUrl, deleteS3Object, getS3ObjectAsJson } from './s3-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env at project root
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const { ADMIN_PASSWORD, JWT_SECRET } = process.env;
if (!ADMIN_PASSWORD || !JWT_SECRET) {
    console.error("FATAL ERROR: ADMIN_PASSWORD and JWT_SECRET must be set in .env file.");
    process.exit(1);
}

const app = express();
const port = process.env.PORT || 3001;
const host = '0.0.0.0';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- AUTHENTICATION ---
app.post('/api/auth/login', (req: ExpressRequest, res: ExpressResponse) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        const token = jwt.sign({ user: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Invalid password' });
    }
});

// Middleware to protect routes
const authenticateJWT = (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, JWT_SECRET, (err: any) => {
            if (err) {
                return res.sendStatus(403); // Forbidden
            }
            next();
        });
    } else {
        res.sendStatus(401); // Unauthorized
    }
};

// --- S3 & DATA MANAGEMENT ROUTES ---

// Get a presigned URL for direct browser-to-S3 upload
app.get('/api/s3/presigned-url', authenticateJWT, async (req: ExpressRequest, res: ExpressResponse) => {
    const { fileName, contentType } = req.query;
    if (typeof fileName !== 'string' || typeof contentType !== 'string') {
        return res.status(400).json({ error: 'fileName and contentType query parameters are required.' });
    }
    try {
        const { url, key } = await generatePresignedPutUrl(fileName, contentType);
        res.json({ url, key });
    } catch (error) {
        console.error('Error generating presigned URL:', error);
        res.status(500).json({ error: 'Could not generate upload URL.' });
    }
});

// Get photographer profile
app.get('/api/profile', authenticateJWT, async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const profile = await getS3ObjectAsJson('profile.json');
        res.json(profile);
    } catch (error: any) {
        if (error.name === 'NoSuchKey') {
            res.status(404).json({ error: 'Profile not found.' });
        } else {
            console.error('Error fetching profile:', error);
            res.status(500).json({ error: 'Failed to fetch profile.' });
        }
    }
});

// Create/Update photographer profile
app.post('/api/profile', authenticateJWT, async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        await putS3Object('profile.json', JSON.stringify(req.body), 'application/json');
        res.status(200).json({ message: 'Profile saved successfully.' });
    } catch (error) {
        console.error('Error saving profile:', error);
        res.status(500).json({ error: 'Failed to save profile.' });
    }
});

// Get albums manifest
app.get('/api/albums', authenticateJWT, async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const manifest = await getS3ObjectAsJson('albums-manifest.json');
        res.json(manifest);
    } catch (error: any) {
        if (error.name === 'NoSuchKey') {
            res.json([]); // Return empty array if manifest doesn't exist
        } else {
            console.error('Error fetching albums manifest:', error);
            res.status(500).json({ error: 'Failed to fetch albums.' });
        }
    }
});

// Save albums manifest
app.post('/api/albums', authenticateJWT, async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        await putS3Object('albums-manifest.json', JSON.stringify(req.body), 'application/json');
        res.status(200).json({ message: 'Albums saved successfully.' });
    } catch (error) {
        console.error('Error saving albums manifest:', error);
        res.status(500).json({ error: 'Failed to save albums.' });
    }
});

// Get public album data (no auth required)
app.get('/api/public/album/:albumKey', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const albumData = await getS3ObjectAsJson(req.params.albumKey);
        res.json(albumData);
    } catch (error) {
        console.error(`Error fetching public album ${req.params.albumKey}:`, error);
        res.status(404).json({ error: 'Album not found.' });
    }
});

// Delete a file from S3 (e.g., an old public JSON file)
app.delete('/api/s3/object/:key', authenticateJWT, async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const key = req.params.key;
        await deleteS3Object(key);
        res.status(200).json({ message: `Object ${key} deleted successfully.`});
    } catch (error) {
        console.error('Error deleting S3 object:', error);
        res.status(500).json({ error: 'Failed to delete file.' });
    }
});


// --- GEMINI API PROXY ROUTES (Protected) ---
app.post('/api/edit-image', authenticateJWT, async (req: ExpressRequest, res: ExpressResponse) => {
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

app.post('/api/generate-description', authenticateJWT, async (req: ExpressRequest, res: ExpressResponse) => {
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

app.post('/api/generate-qr-card', authenticateJWT, async (req: ExpressRequest, res: ExpressResponse) => {
    const { photographerName, profilePicBase64, qrCodeBase64, customPrompt } = req.body;
    if (!photographerName || !profilePicBase64 || !qrCodeBase64) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }
    try {
        const result = await generateQRCodeCard(photographerName, profilePicBase64, qrCodeBase64, customPrompt);
        if (result) {
            res.json({ base64Image: result });
        } else {
            res.status(500).json({ error: 'Failed to generate QR card' });
        }
    } catch (error) {
        console.error('Error in /api/generate-qr-card:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// --- SERVE FRONTEND ---
const clientBuildPath = path.join(__dirname, 'public');
app.use(express.static(clientBuildPath));

app.get('*', (req: ExpressRequest, res: ExpressResponse) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

app.listen(Number(port), host, () => {
    console.log(`[server]: Server listening on port ${port}`);
});
