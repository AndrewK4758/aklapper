import { Label, useScrollIntoView } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import type { SxProps } from '@mui/material/styles';
import { useEffect, useRef, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import { crudHeaderTextSxProps } from '../../../styles/crud-styles.jsx';
import { buttonSXProps } from '../../../styles/pages-styles.js';
import { flexColumnStyles } from '../../../styles/pages-styles.jsx';

const tooltipTitle = 'Response from text query';

interface ChatResponseProps {
  response: string[];
  setLoading: Dispatch<SetStateAction<boolean>>;
  setPromptResponse: Dispatch<SetStateAction<string[]>>;
  chatResponseLabelProps: SxProps;
  chatResponseTextProps: CSSProperties;
}

export function PromptResponse({
  response,
  setLoading,
  setPromptResponse,
  chatResponseLabelProps,
  chatResponseTextProps
}: ChatResponseProps) {
  const divRef = useRef<HTMLDivElement>(null);

  useScrollIntoView(divRef);

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <Box
      key={'chat-response-wrapper-box'}
      id="chat-response-wrapper-box"
      ref={divRef}
      sx={{ ...flexColumnStyles, alignItems: 'center' }}
    >
      <Box key={'chat-response-label-box'} id="chat-response-label-box">
        <Label
          htmlFor="chat-response-label-box"
          placement="top"
          tooltipTitle={tooltipTitle}
          labelVariant={'h3'}
          labelText={'Query Response'}
          labelTextSx={chatResponseLabelProps}
        />
      </Box>
      <Box key={'chat-response-box'} id="chat-response-wrapper-box" sx={{ width: '100%', borderRadius: 1 }}>
        <Container sx={crudHeaderTextSxProps}>
          <pre style={chatResponseTextProps}>{response}</pre>
        </Container>
      </Box>
      <Box key={'chat-response-button-box'} id="chat-response-button-wrapper-box" sx={{ alignSelf: 'flex-end' }}>
        <Button
          key={'chat-response-button'}
          id={'chat-response-button'}
          onClick={() => setPromptResponse([])}
          sx={buttonSXProps}
        >
          Clear
        </Button>
      </Box>
    </Box>
  );
}

export default PromptResponse;
