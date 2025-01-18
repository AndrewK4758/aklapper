import { Router, json, urlencoded } from 'express';
import multer from 'multer';
import generateImages from '../controllers/gen-ai-image-gen.ts';
import promptBuilder from '../controllers/prompt-builder.ts';
import uploadToGcsBucket from '../controllers/upload-files-to-gcs-bucket.ts';
import createContextPath from '../controllers/create-context-path.ts';

const router: Router = Router();

export const uploadStorage = multer.memoryStorage();
export const upload = multer({ storage: uploadStorage });

export class Routes {
  constructor() {
    router.use(json({ limit: '10mb' }));
    router.use(urlencoded({ extended: true, limit: '10mb' }));

    router.get('/context-path', createContextPath);
    router.post('/upload', upload.single('file'), uploadToGcsBucket);
    router.post('/build-prompt', promptBuilder);
    router.post('/images', generateImages);
  }
}

export default router;
