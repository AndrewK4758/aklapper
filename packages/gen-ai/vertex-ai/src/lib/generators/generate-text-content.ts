import type { GenerateContentRequest } from '@google-cloud/vertexai';
import type { PromptRequest } from '../../types/prompt-request-types.ts';
import generativeTextModel from '../models/generative-text-model.js';

export const generateTextContent = async ({ text, fileData }: PromptRequest) => {
  const request: GenerateContentRequest = {
    contents: [
      {
        role: 'system',
        parts: [{ text: 'You are a helpful ai chatbot agent. You want to deliver the best results to any queries.' }],
      },
      {
        role: 'user',
        parts: [{ text: 'Respond without any unnecessary text or format characters' }],
      },
    ],
  };

  if (text && text.length) {
    request.contents[0].parts.push({ text: text });
  }

  if (fileData) {
    const { fileUri, mimeType } = fileData;
    request.contents[0].parts.push({
      fileData: { fileUri: fileUri, mimeType: mimeType },
    });
  }

  return await generativeTextModel.generateContentStream(request);
};

export default generateTextContent;
