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
import { WebsocketContext, type WebsocketContextProps } from '../../../context/websocket_context';

interface PrivateMessageModalProps {
  open: boolean;
  messageTarget: PrivateMessageDetails | null;
  setOpen: Dispatch<SetStateAction<boolean>>;
  setMessages: Dispatch<SetStateAction<PrivateMessageDetails[]>>;
}

export default function PrivateMessageModal({ open, messageTarget, setOpen, setMessages }: PrivateMessageModalProps) {
  const { socket } = useContext<WebsocketContextProps>(WebsocketContext);
  const [message, setMessage] = useState<string>('');

  return (
    <Dialog open={open} slotProps={{ paper: { component: 'form' } }}>
      <DialogTitle sx={{ textAlign: 'center' }}>Private Message</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
            labelTextSx={{ color: '#ffd300' }}
          />
          <OutlinedInput
            autoFocus
            margin='dense'
            name='message'
            type='text'
            label='Message'
            fullWidth
            multiline
            id={`${messageTarget?.target.targetName}-message`}
            onChange={e => setMessage(e.target.value)}
            sx={{ borderRadius: 1 }}
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
            const { sender, target } = messageTarget as PrivateMessageDetails;
            (messageTarget as PrivateMessageDetails).message = message;
            setMessages(prev => [...prev, messageTarget as PrivateMessageDetails]);
            socket.emit('private-message-player', {
              target: target,
              message: message,
              sender: sender,
            });
            setOpen(false);
          }}
        >
          Send
        </Button>
      </DialogActions>
    </Dialog>
  );
}
