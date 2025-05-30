import { Label } from '@aklapper/react-shared';
import type { PrivateMessageDetails } from '@aklapper/types';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import OutlinedInput from '@mui/material/OutlinedInput';
import { useContext, useState, type Dispatch, type SetStateAction } from 'react';
import { MessageContext, type MessagesContextProps } from '../../context/messages_context';
import { WebsocketContext, type WebsocketContextProps } from '../../context/websocket_context';

interface PrivateMessageModalProps {
  open: boolean;
  messageTarget: PrivateMessageDetails | null;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

export default function PrivateMessageModal({ open, messageTarget, setOpen }: PrivateMessageModalProps) {
  const { socket } = useContext<WebsocketContextProps>(WebsocketContext);
  const { addMessage } = useContext<MessagesContextProps>(MessageContext);
  const [message, setMessage] = useState<string>('');

  return (
    <Dialog open={open} slotProps={{ paper: { component: 'form' } }}>
      <DialogTitle sx={{ textAlign: 'center' }}>Private Message</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <DialogContentText color='primary'>{`To: ${messageTarget?.target.targetName}`}</DialogContentText>
        <FormControl>
          <Label
            tooltipTitle={`Enter message for ${messageTarget?.target.targetName} in the input box.`}
            labelVariant={'body1'}
            labelText={'Message'}
            id={`${messageTarget?.target.targetId}-message-label`}
            placement={'top'}
            htmlFor={`${messageTarget?.target.targetName}-message`}
            tooltipSx={{ color: 'ButtonText', backgroundColor: 'GrayText', fontSize: '1rem' }}
          />
          <OutlinedInput
            autoFocus
            name='message'
            type='text'
            label='Message'
            fullWidth
            multiline
            id={`${messageTarget?.target.targetName}-message`}
            onChange={e => setMessage(e.target.value)}
          />
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button id='close-message-button' onClick={() => setOpen(false)}>
          Close
        </Button>
        <Button
          id='send-message-button'
          onClick={() => {
            if (messageTarget) {
              messageTarget.message = message;
              socket.emit('send-private-message', messageTarget);
              addMessage(messageTarget);
            }
            setOpen(false);
          }}
        >
          Send
        </Button>
      </DialogActions>
    </Dialog>
  );
}
