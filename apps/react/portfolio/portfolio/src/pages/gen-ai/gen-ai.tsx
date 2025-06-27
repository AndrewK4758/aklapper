import { useScrollIntoView, Waiting } from '@aklapper/react-shared';
import type { PromptRequest } from '@aklapper/vertex-ai';
import Box from '@mui/material-pigment-css/Box';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import Paper from '@mui/material/Paper';

import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from 'react';
import { Outlet } from 'react-router';
import waiting from '../../assets/images/swirly-dots-to-chrome.webp';
import PromptResponse from '../../components/gen-ai/chat-response/chat-response';
import GenAiHeader from '../../components/gen-ai/header/header';
import { MediaRecorderClientContextProvider } from '../../contexts/audio-context';
import loadContextPath from '../../services/loaders/gen-ai/load-context-path';
import { renderPreTagInsideParentDiv } from '../../styles/gen-ai-styles';
import { fullSizeBlock } from '../../styles/pages-styles';
import Theme from '../../styles/themes/theme';

const PromptBuilder = lazy(() => import('../../components/gen-ai/prompt-builder/prompt-builder.jsx'));

export type LayoutOutletContextProps = {
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
};

const promptInit: PromptRequest = { text: '', fileData: null };

/**
 * This component renders the home page for the generative AI section of the application.
 * It provides an interface for users to interact with the AI model, including building prompts and viewing responses.
 *
 * @returns {ReactElement} The rendered GenAiHome component.
 */

const GenAiHome = (): ReactElement => {
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState<PromptRequest>(promptInit);
  const [isPromptBulderOpen, setIsPromptBuilderOpen] = useState(false);
  const [promptResponse, setPromptResponse] = useState<string[]>([]);
  const divRef = useRef<HTMLDivElement>(null);

  useScrollIntoView(divRef);

  useEffect(() => {
    loadContextPath();
  }, []);

  const handleSetPromptBulderOpen = () => {
    setIsPromptBuilderOpen(!isPromptBulderOpen);
  };

  return (
    <Box
      ref={divRef}
      as={'div'}
      id='gen-ai-wrapper'
      sx={{ display: 'flex', flexDirection: 'column', gap: Theme.spacing(4) }}
    >
      <GenAiHeader isPromptBuilderOpen setIsPromptBuilderOpen={handleSetPromptBulderOpen} />

      {isPromptBulderOpen && (
        <Suspense fallback={<Waiting src={waiting} />}>
          <Collapse in={isPromptBulderOpen}>
            <PromptBuilder loading={loading} setLoading={setLoading} setPrompt={setPrompt} />
          </Collapse>
        </Suspense>
      )}
      <MediaRecorderClientContextProvider>
        <Box as={'div'} id='gen-ai-outlet-wrapper'>
          <Outlet context={{ prompt, promptResponse, loading, setPromptResponse, setLoading }} />
        </Box>
      </MediaRecorderClientContextProvider>
      <Dialog open={loading} component={'div'} id='gen-ai-response-loading-wrapper'>
        <Box as={'div'} id='gen-ai-response-loading-wrapper'>
          <Waiting src={waiting} />
        </Box>
      </Dialog>

      {promptResponse.length > 0 ? (
        <Box as={'div'} id='gen-ai-response-wrapper' sx={{ height: 'fit-content', width: '60vw' }}>
          <Paper component={'div'} id='gen-ai-response-paper' sx={fullSizeBlock}>
            <Container component={'div'} id='gen-ai-response-container' sx={fullSizeBlock}>
              <PromptResponse
                response={promptResponse}
                setLoading={setLoading}
                setPromptResponse={setPromptResponse}
                chatResponseLabelProps={{ textAlign: 'center' }}
                chatResponseTextProps={renderPreTagInsideParentDiv as CSSProperties}
              />
            </Container>
          </Paper>
        </Box>
      ) : null}
    </Box>
  );
};
export default GenAiHome;
