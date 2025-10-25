
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from 'uuid';

const { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET } = process.env;

if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_S3_BUCKET) {
    throw new Error("AWS credentials and bucket name must be configured in environment variables.");
}

const s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
});

export const getS3Object = async (key: string): Promise<ReadableStream | undefined> => {
    const command = new GetObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key,
    });
    const response = await s3Client.send(command);
    return response.Body as ReadableStream | undefined;
};

// Helper to stream a response body to a string
const streamToString = (stream: ReadableStream): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        
        function pump() {
            // Fix: Made the callback async to allow awaiting the arrayBuffer promise.
            reader.read().then(async ({ done, value }) => {
                if (done) {
                    try {
                        const buffer = await new Blob(chunks).arrayBuffer();
                        const text = new TextDecoder("utf-8").decode(buffer);
                        resolve(text);
                    } catch (e) {
                        reject(e);
                    }
                    return;
                }
                chunks.push(value);
                pump();
            }).catch(reject);
        }
        pump();
    });

export const getS3ObjectAsJson = async (key: string): Promise<any> => {
    const stream = await getS3Object(key);
    if (!stream) {
        throw new Error(`Object with key "${key}" has no body.`);
    }
    const bodyString = await streamToString(stream);
    return JSON.parse(bodyString);
};


export const putS3Object = async (key: string, body: string | Buffer, contentType: string): Promise<void> => {
    const command = new PutObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
    });
    await s3Client.send(command);
};

export const deleteS3Object = async (key: string): Promise<void> => {
    const command = new DeleteObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key,
    });
    await s3Client.send(command);
};

export const generatePresignedPutUrl = async (fileName: string, contentType: string): Promise<{ url: string, key: string }> => {
    const fileExtension = fileName.split('.').pop();
    const key = `uploads/${uuidv4()}${fileExtension ? '.' + fileExtension : ''}`;
    
    const command = new PutObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key,
        ContentType: contentType,
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // URL valid for 1 hour
    
    return { url, key };
};
