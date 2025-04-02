import { Label } from '@aklapper/react-shared';
import type { PrivateMessageDetails } from '@aklapper/types';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useContext, useState, type Dispatch, type SetStateAction } from 'react';
import { WebsocketContext, WebsocketContextProps } from '../../../context/websocket_context';

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
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <DialogContentText color="primary">{`To: ${messageTarget?.target.targetName}`}</DialogContentText>
        <Label
          tooltipTitle={`Enter message for ${messageTarget?.target.targetName} in the input box.`}
          labelVariant={'body1'}
          labelText={'Message'}
          id={`${messageTarget?.target.targetId}-message-label`}
          placement={'top'}
          htmlFor={`${messageTarget?.target.targetName}-message`}
          tooltipSx={{ color: 'ButtonText', backgroundColor: 'GrayText', fontSize: '1rem' }}
          labelTextSx={{ color: '#ffd300' }}
        >
          <TextField
            autoFocus
            required
            margin="dense"
            name="message"
            type="text"
            fullWidth
            multiline
            id={`${messageTarget?.target.targetName}-message`}
            variant="outlined"
            onChange={e => setMessage(e.target.value)}
            sx={{ backgroundColor: 'gray', borderRadius: 1 }}
          />
        </Label>
      </DialogContent>
      <DialogActions>
        <Button id="close-message-button" onClick={() => setOpen(false)}>
          <Label
            tooltipTitle={'Close the message dialog box'}
            labelVariant={'button'}
            labelText={'Close'}
            id={'close-message-button-label'}
            placement={'top'}
            htmlFor={'close-message-button'}
            labelTextSx={{ fontSize: '2rem', color: '#ffd300' }}
            tooltipSx={{ color: 'ButtonText', backgroundColor: 'GrayText', fontSize: '1rem' }}
          />
        </Button>
        <Button
          id="send-message-button"
          onClick={() => {
            const { sender, target } = messageTarget as PrivateMessageDetails;
            (messageTarget as PrivateMessageDetails).message = message;
            setMessages(prev => [...prev, messageTarget as PrivateMessageDetails]);
            socket.emit('privateMessagePlayer', {
              target: target,
              message: message,
              sender: sender
            });
            setOpen(false);
          }}
        >
          <Label
            tooltipTitle={`Send message to ${messageTarget?.target.targetName}`}
            labelVariant={'button'}
            labelText={'Send Message'}
            id={'send-message-button-label'}
            placement={'top'}
            htmlFor={'send-message-button'}
            labelTextSx={{ fontSize: '2rem', color: '#ffd300' }}
            tooltipSx={{ color: 'ButtonText', backgroundColor: 'GrayText', fontSize: '1rem' }}
          />
        </Button>
      </DialogActions>
    </Dialog>
  );
}
