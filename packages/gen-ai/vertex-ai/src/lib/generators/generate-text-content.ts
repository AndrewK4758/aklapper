import type { GenerateContentRequest } from '@google-cloud/vertexai';
import type { PromptRequest } from '../../types/prompt-request-types.ts';
import generativeTextModel from '../models/generative-text-model.js';

export const generateTextContent = async ({ text, fileData }: PromptRequest) => {
  const request: GenerateContentRequest = {
    contents: [
      {
        role: 'user',
        parts: [{ text: text as string }],
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
};

export default generateTextContent;
