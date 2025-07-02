import { Text } from '@aklapper/react-shared';
import type { ChatEntry } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
import Divider from '@mui/material/Divider';
import { Fragment, useEffect, useRef, useState } from 'react';
import Theme from '../../../styles/themes/theme.js';
import StyledCard from '../../styled/styled_card';
import PromptResponse from './prompt_response.js';
import Query from './query.js';

type ScrollSpanRefs = {
  [key: string]: HTMLSpanElement;
};

type ExpandedResponsesObj = { [key: string]: boolean };

interface ChatProps {
  loading: boolean;
  chatHistory: ChatEntry[];
}

export function Chat({ chatHistory, loading }: ChatProps) {
  const [expandedResponses, setExpandedResponses] = useState<ExpandedResponsesObj>({});
  const lastChatEntryId = chatHistory[chatHistory.length - 1].id;

  const spanRef = useRef<ScrollSpanRefs>({});
  const chatboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setExpandedResponses(() => {
      const newState: ExpandedResponsesObj = {};

      chatHistory.forEach(chat => {
        newState[chat.id] = false;
        if (chat.id === lastChatEntryId) newState[chat.id] = true;
      });
      return newState;
    });
  }, [chatHistory.length]);

  useEffect(() => {
    if (spanRef.current) {
      const lastChatEntry = spanRef.current[lastChatEntryId];
      if (lastChatEntry) {
        lastChatEntry.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, []);

  return (
    <StyledCard
      sx={{
        backgroundColor: Theme.palette.background.paper,
        width: '70vw ',
        padding: Theme.spacing(4),
      }}
    >
      <div ref={chatboxRef} id='chatbox-ref'>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: Theme.spacing(2),
            width: '100%',
            justifyContent: 'space-between',
            maxHeight: '60vh',
            overflowY: 'auto',
          }}
        >
          <Text
            children='Chat'
            variant='h5'
            sx={{
              borderBottom: `1px solid ${Theme.palette.primary.dark}`,
              width: 'fit-content',
            }}
          />

          {chatHistory.map((chat, idx) => (
            <Fragment key={chat.id}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Query chat={chat} expandedResponses={expandedResponses} setExpandedResponses={setExpandedResponses} />

                <PromptResponse
                  loading={loading}
                  expandedResponses={expandedResponses}
                  chat={chat}
                  idx={idx}
                  chatHistory={chatHistory}
                  spanRef={spanRef}
                />
              </Box>
              <Divider />
            </Fragment>
          ))}
        </Box>
      </div>
    </StyledCard>
  );
}
export default Chat;
