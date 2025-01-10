import axios from 'axios';
const baseUrl = import.meta.env.VITE_LOCAL_SERVER_URL;

export default async function loadAvailableModels(): Promise<string[] | string> {
  try {
    const resp = await axios.get(`${baseUrl}/models`);

    return resp.data;
  } catch (error) {
    console.error(error);
    return `No models found. Please go Ollama ${(<a href="https://ollama.com/search">website</a>)} and select a model to pull.`;
  }
}
