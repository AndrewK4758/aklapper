import { Text } from '@aklapper/react-shared';
import type { ChatEntry } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
import Divider from '@mui/material/Divider';
import { Fragment, useEffect, useRef, useState } from 'react';
import Theme from '../../../styles/themes/theme.js';
import StyledCard from '../../styled/styled_card';
import PromptResponse from './prompt_response.js';
import Query from './query.js';

const MAX_HEIGHT = 400;

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

  setExpandedResponses(() => {
    const newState: ExpandedResponsesObj = {};
    chatHistory.forEach(chat => {
      if (chat.id === lastChatEntryId) {
        newState[chat.id] = true;
      } else {
        newState[chat.id] = false;
      }
    });
    return newState;
  });

  const spanRef = useRef<ScrollSpanRefs>({});
  const chatboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (spanRef.current) {
      const lastChatEntry = spanRef.current[lastChatEntryId];
      if (lastChatEntry) {
        lastChatEntry.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      const currentHeight = entry.contentRect.height;

      if (currentHeight > MAX_HEIGHT) {
        setExpandedResponses(prev => {
          const newState: ExpandedResponsesObj = {};
          for (const id of Object.keys(prev)) {
            if (id === lastChatEntryId) {
              newState[id] = true;
            } else {
              newState[id] = false;
            }
          }
          return newState;
        });
      }
    });
    if (chatboxRef.current) observer.observe(chatboxRef.current);

    return () => {
      observer.disconnect();
    };
  }, [chatHistory]);

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
