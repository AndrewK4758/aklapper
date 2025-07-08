import type { CRUD_BlurResponse } from '@aklapper/types';
import axios from 'axios';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

export default async function getBlurResponse(params: string): Promise<CRUD_BlurResponse> {
  const resp = await axios.get(`${baseURL}/validate/${params}`);

  return resp.data as CRUD_BlurResponse;
}
