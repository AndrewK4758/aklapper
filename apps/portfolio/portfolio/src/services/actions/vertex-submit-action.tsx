import axios from 'axios';

import { ActionFunction, ActionFunctionArgs } from 'react-router';

const baseUrl = import.meta.env.VITE_VERTEX_API_URL;

const vertexSubmitAction: ActionFunction = async ({ request }: ActionFunctionArgs) => {
  const { promptInput } = await request.json();

  console.log(promptInput);

  const resp = await axios.post(
    `${baseUrl}/text`,
    { input: promptInput },
    { headers: { 'Content-Type': `application/json` } }
  );

  const { vertexResponse } = resp.data;

  return vertexResponse;
};

export default vertexSubmitAction;

