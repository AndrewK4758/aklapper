import type { GcsBucketPath } from '@aklapper/vertex-ai';
import { Storage } from '@google-cloud/storage';

const bucketName = 'portfolio-gen-ai';

const storagePath: GcsBucketPath = `gs://${bucketName}/`;

const memoryUpload = async (contextPath: string, { buffer, originalname }: Express.Multer.File) => {
  try {
    const storage = new Storage();

    await storage.bucket(bucketName).file(`${contextPath}/${originalname}`).save(buffer);

    const pathWithContext = `${storagePath}${contextPath}/${originalname}`;

    console.log(pathWithContext);

    return pathWithContext;
  } catch (error) {
    console.error(error);

    return null;
  }
};

export default memoryUpload;
