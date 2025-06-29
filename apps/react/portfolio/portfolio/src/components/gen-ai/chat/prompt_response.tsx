import { Text, Waiting } from '@aklapper/react-shared';
import type { ChatEntry } from '@aklapper/types';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';
import Box from '@mui/material-pigment-css/Box';
import Collapse from '@mui/material/Collapse';
import type { RefObject } from 'react';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';
import Theme from '../../../styles/themes/theme.js';

type ScrollSpanRefs = {
  [key: string]: HTMLSpanElement;
};

type ExpandedResponsesObj = { [key: string]: boolean };

interface PromptResponseProps {
  loading: boolean;
  expandedResponses: ExpandedResponsesObj;
  chat: ChatEntry;
  idx: number;
  chatHistory: ChatEntry[];
  spanRef: RefObject<ScrollSpanRefs>;
}

export default function PromptResponse({
  loading,
  expandedResponses,
  chat,
  idx,
  chatHistory,
  spanRef,
}: PromptResponseProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: Theme.spacing(4),
        overflow: 'hidden',
        padding: `${Theme.spacing(0.5)} 0`,
      }}
    >
      <DeveloperBoardIcon />

      {loading && idx === chatHistory.length - 1 ? (
        <Waiting src={waiting} />
      ) : (
        <Collapse in={expandedResponses[chat.id]} collapsedSize={'3ch'}>
          <Box id={chat.id} sx={{ overflowY: expandedResponses[chat.id] ? 'auto' : 'hidden', maxHeight: '17.5vh' }}>
            <Text variant='body2' children={chat.response} sx={{ lineHeight: 1.5, textAlign: 'start' }} />
          </Box>
        </Collapse>
      )}
      <span ref={el => handleSetChatRespRef(spanRef, chat.id, el)} />
    </Box>
  );
}

function handleSetChatRespRef(ref: RefObject<ScrollSpanRefs>, id: string, el: HTMLSpanElement | null) {
  if (el) ref.current[id] = el;
}
