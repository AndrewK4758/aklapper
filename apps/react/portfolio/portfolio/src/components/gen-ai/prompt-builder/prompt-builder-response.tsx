import Box from '@mui/material-pigment-css/Box';
import type { ReactElement } from 'react';

interface PromptBuilderResponseProps {
  prompt: string | null;
}

/**
 * This component renders the generated prompt in a formatted way.
 *
 * @param {PromptBuilderResponseProps} props - The props for the PromptBuilderResponse component.
 * @param {string} props.prompt - The generated prompt.
 * @returns {ReactElement} The rendered PromptBuilderResponse component.
 */

export const PromptBuilderResponse = ({ prompt }: PromptBuilderResponseProps): ReactElement => (
  <Box>
    <pre>{prompt}</pre>
  </Box>
);

export default PromptBuilderResponse;
