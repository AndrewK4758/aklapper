import { useScrollIntoView, Waiting } from '@aklapper/react-shared';
import type { PromptRequest } from '@aklapper/vertex-ai';
import Box from '@mui/material-pigment-css/Box';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import { lazy, Suspense, useEffect, useRef, useState, type ReactElement } from 'react';
import { Outlet } from 'react-router';
import waiting from '../../assets/images/swirly-dots-to-chrome.webp';
import GenAiHeader from '../../components/gen-ai/header/header';
import PromptResponse from '../../components/gen-ai/prompt-response/prompt-response.js';
import CenteredFlexDiv from '../../components/styled/centered_flexbox';
import StyledCard from '../../components/styled/styled_card';
import { MediaRecorderClientContextProvider } from '../../contexts/audio-context';
import loadContextPath from '../../services/loaders/gen-ai/load-context-path';
import Theme from '../../styles/themes/theme';

const PromptBuilder = lazy(() => import('../../components/gen-ai/prompt-builder/prompt-builder.jsx'));

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
    <CenteredFlexDiv ref={divRef} as={'div'} id='gen-ai-wrapper'>
      <GenAiHeader isPromptBuilderOpen={isPromptBulderOpen} setIsPromptBuilderOpen={handleSetPromptBulderOpen} />

      {isPromptBulderOpen && (
        <Suspense fallback={<Waiting src={waiting} />}>
          <Collapse in={isPromptBulderOpen} sx={{ display: 'flex', justifyItems: 'center' }}>
            <PromptBuilder loading={loading} setLoading={setLoading} setPrompt={setPrompt} />
          </Collapse>
        </Suspense>
      )}
      <MediaRecorderClientContextProvider>
        <Box as={'div'} id='gen-ai-outlet-wrapper' sx={{ width: '65%' }}>
          <Outlet context={{ prompt, promptResponse, loading, setPromptResponse, setLoading }} />
        </Box>
      </MediaRecorderClientContextProvider>
      <Dialog open={loading} component={'div'} id='gen-ai-response-loading-wrapper'>
        <Box as={'div'} id='gen-ai-response-loading-wrapper'>
          <Waiting src={waiting} />
        </Box>
      </Dialog>

      {promptResponse.length > 0 ? (
        <StyledCard
          sx={{
            backgroundColor: Theme.palette.background.paper,
            width: '70vw ',
            padding: Theme.spacing(4),
          }}
        >
          <PromptResponse response={promptResponse} setLoading={setLoading} setPromptResponse={setPromptResponse} />
        </StyledCard>
      ) : null}
    </CenteredFlexDiv>
  );
};
export default GenAiHome;
