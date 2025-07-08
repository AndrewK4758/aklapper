import { CenteredFlexDiv, useScrollIntoView, Waiting } from '@aklapper/react-shared';
import type { ChatEntry } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
import Collapse from '@mui/material/Collapse';
import { lazy, Suspense, useEffect, useRef, useState, type ReactElement } from 'react';
import { Outlet } from 'react-router';
import waiting from '../../assets/images/swirly-dots-to-chrome.webp';
import Chat from '../../components/gen-ai/chat/chat';
import GenAiHeader from '../../components/gen-ai/header/header';
import { MediaRecorderClientContextProvider } from '../../contexts/audio-context';
import loadContextPath from '../../services/loaders/gen-ai/load-context-path';
import type { OutletContextProps } from '../../types/types';

const PromptBuilder = lazy(() => import('../../components/gen-ai/prompt-builder/prompt-builder'));

const chatEntryInit: ChatEntry[] = [];

/**
 * This component renders the home page for the generative AI section of the application.
 * It provides an interface for users to interact with the AI model, including building prompts and viewing responses.
 *
 * @returns {ReactElement} The rendered GenAiHome component.
 */

const GenAiHome = (): ReactElement => {
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>(chatEntryInit);
  const [isPromptBulderOpen, setIsPromptBuilderOpen] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);

  useScrollIntoView(divRef);

  useEffect(() => {
    loadContextPath();
  }, []);

  const handleSetPromptBulderOpen = () => {
    setIsPromptBuilderOpen(!isPromptBulderOpen);
  };

  return (
    <CenteredFlexDiv ref={divRef} as={'div'} id='gen-ai-wrapper' sx={{ padding: 0 }}>
      <GenAiHeader isPromptBuilderOpen={isPromptBulderOpen} setIsPromptBuilderOpen={handleSetPromptBulderOpen} />

      {isPromptBulderOpen && (
        <Suspense fallback={<Waiting src={waiting} />}>
          <Collapse in={isPromptBulderOpen} sx={{ display: 'flex', justifyItems: 'center' }}>
            <PromptBuilder loading={loading} setLoading={setLoading} setUserChatEntry={setChatHistory} />
          </Collapse>
        </Suspense>
      )}

      {chatHistory.length ? <Chat chatHistory={chatHistory} loading={loading} /> : null}

      <Box as={'div'} id='gen-ai-outlet-wrapper' sx={{ width: '65%' }}>
        <Suspense fallback={<Waiting src={waiting} />}>
          <MediaRecorderClientContextProvider>
            <Outlet context={{ chatHistory, loading, setChatHistory, setLoading } as OutletContextProps} />
          </MediaRecorderClientContextProvider>
        </Suspense>
      </Box>
    </CenteredFlexDiv>
  );
};
export default GenAiHome;
