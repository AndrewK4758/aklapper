import { SectionTitle, Text, useScrollIntoView } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useEffect, useRef } from 'react';
import Theme from '../../../styles/themes/theme';

interface PromptResponseProps {
  response: string[];
  setLoading: (loading: boolean) => void;
  setPromptResponse: (response: string[]) => void;
}

export function PromptResponse({ response, setLoading, setPromptResponse }: PromptResponseProps) {
  const divRef = useRef<HTMLDivElement>(null);

  useScrollIntoView(divRef);

  useEffect(() => {
    setLoading(false);
  }, [response]);

  return (
    <Box
      id='chat-response-wrapper-box'
      ref={divRef}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: Theme.spacing(4),
        width: '100%',
        justifyContent: 'space-between',
      }}
    >
      <SectionTitle title='Response' variant='h5' />

      <Text id='char-response' variant='body2' children={response} sx={{ lineHeight: 1.5 }} />

      <Button
        key={'chat-response-button'}
        id={'chat-response-button'}
        onClick={() => setPromptResponse([])}
        sx={{ alignSelf: 'flex-end' }}
      >
        Clear
      </Button>
    </Box>
  );
}
export default PromptResponse;
