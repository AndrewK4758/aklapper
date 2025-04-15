import axios from 'axios';
import type { ActionFunction, ActionFunctionArgs } from 'react-router';

const baseURL = import.meta.env.VITE_VERTEX_API_URL;

const handlePromptBuilder: ActionFunction = async ({ request }: ActionFunctionArgs) => {
  try {
    const formData = await request.json();

    const resp = await axios.post(`${baseURL}/build-prompt`, formData, {
      headers: { 'Content-Type': 'application/json' },
    });

    return resp.data.finalPrompt;
  } catch (error) {
    console.log(error);
    return null;
  }
};

export default handlePromptBuilder;
