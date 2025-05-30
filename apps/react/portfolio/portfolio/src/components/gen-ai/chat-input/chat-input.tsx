import { FormikTextInput, type FormActionProps } from '@aklapper/react-shared';
import type { PromptRequest } from '@aklapper/vertex-ai';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import type { SxProps } from '@mui/material/styles';
import { useFormik, type FormikState, type FormikValues } from 'formik';
import type { Dispatch, SetStateAction } from 'react';
import { Form } from 'react-router';
import type { Socket } from 'socket.io-client';
import * as Yup from 'yup';
import { errorTextSx, tooltipSx } from '../../../styles/pages-styles.js';

interface ChatInputProps<T extends Yup.Maybe<Yup.AnyObject>> extends FormActionProps {
  breakpointsChatInputButton: SxProps;
  breakpointsChatInputText: SxProps;
  breakpointsChatInputLabel: SxProps;
  labelText: string;
  breakpointsWrapperBoxSx: SxProps;
  socket: Socket;
  initialValues: T;
  validationSchema: Yup.ObjectSchema<T>;
  setLoading: Dispatch<SetStateAction<boolean>>;
}

export const ChatInput = <T extends FormikValues>({
  method,
  names,
  labelText,
  type,
  variant,
  buttonText,
  buttonType,
  socket,
  setLoading,
  initialValues,
  validationSchema,
  breakpointsChatInputText,
  breakpointsChatInputLabel,
  breakpointsChatInputButton,
  breakpointsWrapperBoxSx,
}: ChatInputProps<T>) => {
  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: ({ text, fileData }, { resetForm }) => submitPrompt<T>({ text, fileData }, resetForm, socket, setLoading),
    onReset: () => null,
  });

  return (
    <Box
      component={'div'}
      key={`gen-ai-text-input-wrapper`}
      id={`gen-ai-text-input-wrapper`}
      sx={breakpointsWrapperBoxSx}
    >
      <Form
        key={'chat-input-form'}
        id='chat-input-form'
        method={method}
        onSubmit={formik.handleSubmit}
        onReset={formik.handleReset}
        style={{ display: 'flex', flexWrap: 'wrap' }}
      >
        <Box key={'chat-input-form-text-box'} id='chat-input-form-text-box' sx={{ flex: '1 0 100%', paddingY: 4 }}>
          <FormikTextInput<T>
            key={'chat-input-form-text-input'}
            id='chat-input-form-text-input'
            autoComplete='off'
            formik={formik}
            type={type}
            name={names[0]}
            textSx={breakpointsChatInputText}
            label={labelText}
            labelComponent={'h2'}
            labelSx={breakpointsChatInputLabel}
            valueField={'text'}
            errorTextSx={errorTextSx}
            tooltipTitle={'Enter prompt query here'}
            tooltipSx={tooltipSx}
          />
        </Box>
        <Box
          key={'chat-input-form-button-box'}
          id={'chat-input-form-button-box'}
          component={'section'}
          display={'flex'}
          flex={'1 0 100%'}
          justifyContent={'flex-end'}
        >
          <Button
            key={'chat-input-form-button'}
            id='chat-input-form-button'
            variant={variant}
            type={buttonType}
            sx={breakpointsChatInputButton}
            title={buttonText}
          >
            {buttonText}
          </Button>
        </Box>
      </Form>
    </Box>
  );
};

export default ChatInput;

const submitPrompt = <T,>(
  { text, fileData }: PromptRequest,
  resetForm: (nextState?: Partial<FormikState<T>> | undefined) => void,
  socket: Socket,
  setLoading: Dispatch<SetStateAction<boolean>>,
) => {
  try {
    setLoading(true);
    const promptRequest: PromptRequest = {
      text: text,
      fileData: fileData,
    };

    socket.emit('prompt', promptRequest);
    resetForm();
  } catch (err) {
    console.error(err);
  }
};
