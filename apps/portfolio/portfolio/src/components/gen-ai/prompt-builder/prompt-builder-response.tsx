import { Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import type { CSSProperties } from 'react';
import { crudHeaderTextSxProps } from '../../../styles/crud-styles';
import { renderPreTagInsideParentDiv } from '../../../styles/gen-ai-styles';
import { fullSizeBlock } from '../../../styles/pages-styles';

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
  <Box sx={fullSizeBlock}>
    <Text
      key={'prompt-response-text'}
      id="prompt-response-text"
      component={'p'}
      titleVariant="body1"
      titleText={<pre style={renderPreTagInsideParentDiv as CSSProperties}>{prompt}</pre>}
      sx={crudHeaderTextSxProps}
    />
  </Box>
);

export default PromptBuilderResponse;
