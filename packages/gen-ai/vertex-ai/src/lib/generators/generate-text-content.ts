import type { ChatEntry } from '@aklapper/types';
import type { GenerateContentRequest } from '@google-cloud/vertexai';
import generativeTextModel from '../models/generative-text-model.js';

export async function generateTextContent({ prompt, fileData }: ChatEntry) {
  const request: GenerateContentRequest = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt as string }],
      },
    ],
  };

  if (fileData) {
    const { fileUri, mimeType } = fileData;
    request.contents[0].parts.push({
      fileData: { fileUri: fileUri, mimeType: mimeType },
    });
  }

  return await generativeTextModel.generateContentStream(request);
}

export default generateTextContent;
