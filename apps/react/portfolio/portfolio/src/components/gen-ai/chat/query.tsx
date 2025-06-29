import { Text } from '@aklapper/react-shared';
import type { ChatEntry } from '@aklapper/types';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PersonIcon from '@mui/icons-material/Person';
import Box from '@mui/material-pigment-css/Box';
import IconButton from '@mui/material/IconButton';
import Theme from '../../../styles/themes/theme.js';

type ExpandedResponsesObj = { [key: string]: boolean };

interface QueryProps {
  chat: ChatEntry;
  expandedResponses: ExpandedResponsesObj;
  setExpandedResponses: (callback: (expRespObj: ExpandedResponsesObj) => ExpandedResponsesObj) => void;
}

export default function Query({ chat, expandedResponses, setExpandedResponses }: QueryProps) {
  const handleToggleResponses = (id: string) => {
    setExpandedResponses(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <Box sx={{ display: 'flex', padding: `${Theme.spacing(0.5)} 0` }}>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: Theme.spacing(4) }}>
        <PersonIcon />
        <Text variant='body2' children={chat.prompt as string} sx={{ fontWeight: 'bold', textAlign: 'start' }} />
        <Box onClick={() => handleToggleResponses(chat.id)} sx={{ display: 'flex', alignItems: 'center' }}>
          {expandedResponses[chat.id] ? <ArrowRightIcon /> : <ArrowDropDownIcon />}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <IconButton onClick={async () => await navigator.clipboard.writeText(chat.response)}>
          <ContentCopyIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
