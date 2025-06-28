import { useScrollIntoView } from '@aklapper/react-shared';
import type { PromptRequest } from '@aklapper/vertex-ai';
import type { FileData } from '@google-cloud/vertexai';
import Button from '@mui/material/Button';
import type { FormikState } from 'formik';
import { useFormik } from 'formik';
import { useRef, type ReactElement } from 'react';
import { Form, useOutletContext } from 'react-router';
import { io, type Socket } from 'socket.io-client';
import * as Yup from 'yup';
import useGenAiWebsockets from '../../../hooks/useGenAiWebsockets';
import Theme from '../../../styles/themes/theme';
import type { OutletContextProps } from '../../../types/types.js';
import StyledCard from '../../styled/styled_card';
import TextInput from '../../styled/text_input';

const promptInit: PromptRequest = { text: '', fileData: null };

const validationSchema = Yup.object<PromptRequest>().shape({
  text: Yup.string().required('Must be a valid question or statement').min(2, 'Must be a valid question or statement'),
  fileData: Yup.mixed<FileData>().nullable().notRequired(),
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
  const { setLoading, setPromptResponse } = useOutletContext<OutletContextProps>();
  const divRef = useRef<HTMLDivElement>(null);

  useScrollIntoView(divRef);

  useGenAiWebsockets(socket, setPromptResponse);
  const formik = useFormik<PromptRequest>({
    initialValues: promptInit,
    validationSchema: validationSchema,
    onSubmit: (values, { resetForm }) => submitPrompt(values, resetForm, socket, setLoading),
  });
  return (
    <StyledCard sx={{ padding: Theme.spacing(4), width: '100%' }}>
      <Form id='chat-input-form' method='post' onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
        <TextInput<PromptRequest>
          name={'text'}
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

function submitPrompt<PromptRequest>(
  values: PromptRequest,
  resetForm: (nextState?: FormikState<PromptRequest>) => void,
  socket: Socket,
  setLoading: (loading: boolean) => void,
) {
  try {
    setLoading(true);

    socket.emit('prompt', values);
  } catch (err) {
    console.error(err);
  } finally {
    resetForm();
  }
}
