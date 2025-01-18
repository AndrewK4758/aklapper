import { Request, Response } from 'express';
import memoryUpload from '../services/upload-to-gcs-bucket.ts';

const uploadToGcsBucket = async (req: Request, resp: Response) => {
  try {
    const { contextPath } = req.body;

    const file = req.file;

    if (file) {
      const result = await memoryUpload(contextPath as string, file);

      resp.status(201).json({ path: result });
    } else resp.status(204).json({ error: 'No file present on upload.' });
  } catch (error) {
    console.error(error);
    resp.status(500).json({ error: 'File upload unsucessful.' });
  }
};
export default uploadToGcsBucket;
