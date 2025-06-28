import { Text } from '@aklapper/react-shared';
import Box from '@mui/material-pigment-css/Box';
import type { CSSProperties } from 'react';
import { renderPreTagInsideParentDiv } from '../../../styles/gen-ai-styles.jsx';

interface PromptBuilderResponseProps {
  prompt: string;
}

/**
 * This component renders the generated prompt in a formatted way.
 *
 * @param {PromptBuilderResponseProps} props - The props for the PromptBuilderResponse component.
 * @param {string} props.prompt - The generated prompt.
 * @returns {JSX.Element} The rendered PromptBuilderResponse component.
 */

export const PromptBuilderResponse = ({ prompt }: PromptBuilderResponseProps) => (
  <Box>
    <Text
      id='prompt-response-text'
      variant='body1'
      children={<pre style={renderPreTagInsideParentDiv as CSSProperties}>{prompt}</pre>}
    />
  </Box>
);

export default PromptBuilderResponse;
