import { useScrollIntoView } from '@aklapper/react-shared';
import Button from '@mui/material/Button';
import type { FormikState } from 'formik';
import { useFormik } from 'formik';
import { useRef, type Dispatch, type ReactElement, type SetStateAction } from 'react';
import { Form, useOutletContext } from 'react-router';
import ShortUniqueId from 'short-unique-id';
import { io, type Socket } from 'socket.io-client';
import * as Yup from 'yup';
import useGenAiWebsockets from '../../../hooks/useGenAiWebsockets';

import type { ChatEntry } from '@aklapper/types';
import Theme from '../../../styles/themes/theme';
import type { OutletContextProps } from '../../../types/types.js';
import StyledCard from '../../styled/styled_card';
import TextInput from '../../styled/text_input';

/**
 * DECIDE WHETHER TO PUT FILE UPLOAD IN THE MAIN PROMPT SUBMISSION AREA
 */
// const promptInit: PromptRequest = { text: '', fileData: null };

const promptInit: ChatEntry = {
  id: '',
  prompt: '',
  response: '',
  fileData: null,
};
const validationSchema = Yup.object<ChatEntry>().shape({
  prompt: Yup.string()
    .required('Must be a valid question or statement')
    .min(2, 'Must be a valid question or statement'),
});

const wsURL = import.meta.env.VITE_VERTEX_WS_URL;

/**
 * This component renders the text generation section of the generative AI page.
 * It allows users to input a prompt and send it to the AI model for processing.
 *
 * @returns {ReactElement} The rendered TextGenerator wwcomponent.
 */

const TextGenerator = (): ReactElement => {
  const clientIo = io(wsURL, {
    autoConnect: false,
    reconnectionAttempts: 10,
    reconnectionDelay: 2500,
    withCredentials: false,
    secure: true,
  });
  const socketRef = useRef<Socket>(clientIo);
  const socket = socketRef.current;
  const { setLoading, setChatHistory } = useOutletContext<OutletContextProps>();
  const divRef = useRef<HTMLDivElement>(null);

  useScrollIntoView(divRef);

  useGenAiWebsockets(socket, setChatHistory);

  const formik = useFormik<ChatEntry>({
    initialValues: promptInit,
    validationSchema: validationSchema,
    onSubmit: (values, { resetForm }) => submitPrompt(values, resetForm, socket, setLoading, setChatHistory),
  });
  return (
    <StyledCard sx={{ padding: Theme.spacing(4), width: '100%' }}>
      <Form id='chat-input-form' method='post' onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
        <TextInput<ChatEntry>
          name={'prompt'}
          formik={formik}
          label='Enter Prompt'
          type='text'
          variant={'outlined'}
          slotProps={{ input: { sx: { backgroundColor: Theme.palette.background.default } } }}
        />

        <Button id='chat-input-form-submit' type='submit' sx={{ marginRight: Theme.spacing(4) }}>
          Submit Prompt
        </Button>
        <Button id='chat-input-form-reset' type='reset' sx={{ marginLeft: Theme.spacing(4) }}>
          Reset
        </Button>
      </Form>
    </StyledCard>
  );
};

export default TextGenerator;

function submitPrompt(
  values: ChatEntry,
  resetForm: (nextState?: FormikState<ChatEntry>) => void,
  socket: Socket,
  setLoading: (loading: boolean) => void,
  setChatHistory: Dispatch<SetStateAction<ChatEntry[]>>,
) {
  try {
    setLoading(true);

    const chatEntry: ChatEntry = {
      id: new ShortUniqueId().rnd(6),
      prompt: values.prompt,
      response: '',
      fileData: null,
    };

    setChatHistory(prev => [...prev, chatEntry]);

    socket.emit('prompt', chatEntry, (resp: Response) => {
      const { status } = resp;
      if (status === 200) {
        resetForm();
        setLoading(false);
      }
    });
  } catch (err) {
    console.error(err);
  }
}
