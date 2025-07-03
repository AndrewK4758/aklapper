import type { PromptRequest } from '@aklapper/vertex-ai';
import axios from 'axios';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { getContextPath } from '../../../utils/utils';

const baseUrl = import.meta.env.VITE_VERTEX_API_URL;
/**
 * This function handles the file upload event.
 * It uploads the file to the server and updates the prompt state with the file data.
 *
 * @param {RefObject<HTMLInputElement | null>} fileInputRef - A ref to the file input element.
 * @param {Dispatch<SetStateAction<PromptRequest>>} setPrompt - A function to update the prompt state.
 * @param {Dispatch<SetStateAction<string>>} setFileName - A function to update the file name state.
 * @param {Dispatch<SetStateAction<boolean>>} setLoading - A function to update the loading state.
 */
export default async function handleFileUpload(
  prompt: PromptRequest,
  fileInputRef: RefObject<HTMLInputElement | null>,
  setPrompt: Dispatch<SetStateAction<PromptRequest>>,
  setFileName: Dispatch<SetStateAction<string>>,
  setLoading: (loading: boolean) => void,
) {
  try {
    if (fileInputRef.current && fileInputRef.current.files) {
      const file = fileInputRef.current.files[0];
      const contextPath = getContextPath('context-path');
      setLoading(true);
      const resp = await axios.post(
        `${baseUrl}/upload`,
        { file: file, contextPath: contextPath },
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      const { path } = resp.data as { path: string };

      const newPrompt: PromptRequest = {
        ...prompt,
        fileData: { fileUri: path, mimeType: file.type },
      };
      setPrompt(newPrompt);
      setFileName(file.name);
    } else throw new Error('No file ref');
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false);
  }
}
