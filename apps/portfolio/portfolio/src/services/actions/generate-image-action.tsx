import type { ImagenConfig } from '@aklapper/vertex-ai';
import axios from 'axios';
import { type ActionFunction, type ActionFunctionArgs } from 'react-router';

const baseURL = import.meta.env.VITE_VERTEX_API_URL;

const generateImageAction: ActionFunction = async ({ request }: ActionFunctionArgs) => {
  const values = (await request.json()) as Partial<ImagenConfig>;
  const { prompt, sampleCount, aspectRatio, seed } = values;
  try {
    const resp = await axios.post(
      `${baseURL}/images`,
      { prompt: prompt, sampleCount: Number(sampleCount), aspectRatio: aspectRatio, seed: seed },
      { headers: { 'Content-Type': 'application/json' } }
    );

    return resp.data as string[];
  } catch (error) {
    console.error(error);
    return null;
  }
};

export default generateImageAction;
