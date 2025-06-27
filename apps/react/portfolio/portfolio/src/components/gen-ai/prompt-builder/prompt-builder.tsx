import { ResponseType, type IPromptInputData } from '@aklapper/prompt-builder';
import { FormikValidationError, Label, Text, useScrollIntoView } from '@aklapper/react-shared';
import { getContextPath } from '@aklapper/utils';
import type { PromptRequest } from '@aklapper/vertex-ai';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import axios from 'axios';
import { useFormik } from 'formik';
import { useRef, useState, type Dispatch, type JSX, type RefObject, type SetStateAction } from 'react';
import { Form, useActionData, useNavigate, useSubmit, type NavigateFunction, type SubmitTarget } from 'react-router';
import * as Yup from 'yup';
import {
  formLabelSxProps,
  helperTextSx,
  promptBuilderRadioGroupSxProps,
  promptBuilderResponseFormatBoxSxProps,
  promptBuilderResponseFormatIconsSxProps,
  promptBuilderResponseFormatLabelSxProps,
  promptBuilderTextFieldSlotProps,
  promptBuilderUploadFileTextSxProps,
  radioButtonLabelSxProps,
  radioButtonLabelWrapperSxProps,
} from '../../../styles/gen-ai-styles.jsx';
import { buttonSXProps, flexColumnStyles, fullSizeBlock } from '../../../styles/pages-styles.jsx';
import Theme from '../../../styles/themes/theme';
import ImageIcon from '../../icons/image-icon.jsx';
import JsonIcon from '../../icons/json-icon.jsx';
import TextIcon from '../../icons/text-icon.jsx';
import CenteredFlexDiv from '../../styled/centered_flexbox';
import HelperTextBox from '../../styled/helper_text_box';
import StyledCard from '../../styled/styled_card';
import { SUPPORTED_FORMATS } from '../static/definitions.jsx';
import { promptBuilderHeaderText } from '../static/prompt-builder-text.jsx';
import PromptBuilderResponse from './prompt-builder-response.jsx';

const initialValues: IPromptInputData = {
  objective: '',
  instructions: '',
  textData: '',
  examples: '',
  constraints: '',
  tone: '',
  responseFormat: ResponseType.TEXT,
  responseInstructions: '',
};

const validationSchema = Yup.object({
  objective: Yup.string().required('Must have valid objective statement'),
  instructions: Yup.string(),
  textData: Yup.string(),
  examples: Yup.string(),
  constraints: Yup.string(),
  tone: Yup.string(),
  resposeFormat: Yup.string().oneOf(Object.values(ResponseType)),
  responseInstructions: Yup.string(),
});

interface PromptBuilderProps {
  loading: boolean;
  setPrompt: Dispatch<SetStateAction<PromptRequest>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
}

/**
 * This component renders a form for building prompts for the generative AI model.
 * It allows users to input various parameters for the prompt and then submits the data to the server to generate a prompt.
 *
 * @param {PromptBuilderProps} props - The props for the PromptBuilder component.
 * @param {boolean} props.loading - Whether the prompt is being generated.
 * @param {Dispatch<SetStateAction<PromptRequest>>} props.setPrompt - A function to update the prompt state.
 * @param {Dispatch<SetStateAction<boolean>>} props.setLoading - A function to update the loading state.
 * @returns {JSX.Element} The rendered PromptBuilder component.
 */

const PromptBuilder = ({ loading, setPrompt, setLoading }: PromptBuilderProps): JSX.Element => {
  const [openPromptResponse, setOpenPromptResponse] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const submit = useSubmit();
  const nav = useNavigate();

  const action = useActionData() as string;

  useScrollIntoView(divRef);

  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: values => submit(values as SubmitTarget, { method: 'POST', encType: 'application/json' }),
    onReset: () => setFileName(''),
    validateOnBlur: true,
    validateOnChange: true,
  });

  /**
   * This function handles the file upload button click event.
   * It triggers the hidden file input element to open the file selection dialog.
   */

  const handleFileUploadButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <Box component={'div'} key={'prompt-builder-wrapper'} id='prompt-builder-wrapper' ref={divRef}>
      <StyledCard key={'prompt-builder-paper'} id='prompt-builder-paper'>
        <CenteredFlexDiv id='prompt-builder'>
          <Box component={'section'} id='prompt-builder-header-box' sx={{ display: 'flex' }}>
            <Text variant='h4' children={'Prompt Builder'} sx={{ flex: '0 1 25%' }} />
            <Divider orientation='vertical' flexItem />
            <Text
              variant='body1'
              children={promptBuilderHeaderText}
              sx={{ flex: '0 1 75%', padding: Theme.spacing(4) }}
            />
          </Box>
          <Form
            key={'prompt-builder-form'}
            method='POST'
            onSubmit={formik.handleSubmit}
            onReset={formik.handleReset}
            style={{ width: '80%' }}
          >
            <Box component={'section'} key={'prompt-builder-input-elements-box'} id='prompt-builder-input-elements-box'>
              <HelperTextBox multiline>
                <TextField
                  id='prompt-builder-objective'
                  label='Objective'
                  multiline={true}
                  focused={true}
                  fullWidth={true}
                  rows={2}
                  placeholder='What you want the AI todo'
                  variant='outlined'
                  onBlur={formik.handleBlur}
                  onFocus={async e => await formik.setFieldTouched(e.currentTarget.name as string, false)}
                  onChange={formik.handleChange}
                  onReset={formik.handleReset}
                  name={'objective'}
                  sx={{ backgroundColor: Theme.palette.background.default, borderRadius: Theme.shape.borderRadius }}
                  value={formik.values.objective}
                  slotProps={promptBuilderTextFieldSlotProps}
                />
                <FormikValidationError<IPromptInputData>
                  elementName='objective'
                  formik={formik}
                  helperTextSx={helperTextSx}
                />
              </HelperTextBox>

              <HelperTextBox multiline>
                <TextField
                  label='Instructions'
                  id='prompt-builder-instructions'
                  multiline={true}
                  fullWidth={true}
                  rows={2}
                  placeholder='How you want the AI to execute the objective'
                  variant='outlined'
                  onBlur={formik.handleBlur}
                  onFocus={async e => formik.setFieldTouched(e.currentTarget.name as string, false)}
                  onChange={formik.handleChange}
                  onReset={formik.handleReset}
                  name={'instructions'}
                  sx={{ backgroundColor: Theme.palette.background.default, borderRadius: Theme.shape.borderRadius }}
                  value={formik.values.instructions}
                  slotProps={promptBuilderTextFieldSlotProps}
                />
                <FormikValidationError<IPromptInputData>
                  elementName='instructions'
                  formik={formik}
                  helperTextSx={helperTextSx}
                />
              </HelperTextBox>

              <HelperTextBox multiline>
                <TextField
                  label='Text Data'
                  id='prompt-builder-text-data'
                  multiline={true}
                  fullWidth={true}
                  rows={2}
                  placeholder='Copy & Paste any simple text for context or processing'
                  variant='outlined'
                  onBlur={formik.handleBlur}
                  onFocus={async e => formik.setFieldTouched(e.currentTarget.name as string, false)}
                  onChange={formik.handleChange}
                  onReset={formik.handleReset}
                  name={'textData'}
                  sx={{ backgroundColor: Theme.palette.background.default, borderRadius: Theme.shape.borderRadius }}
                  value={formik.values.textData}
                  slotProps={promptBuilderTextFieldSlotProps}
                />
                <FormikValidationError<IPromptInputData>
                  elementName='textData'
                  formik={formik}
                  helperTextSx={helperTextSx}
                />
              </HelperTextBox>
              <HelperTextBox multiline>
                <TextField
                  label='Examples'
                  id='prompt-builder-examples'
                  multiline={true}
                  fullWidth={true}
                  rows={2}
                  placeholder='Show AI Example of your desired outcome'
                  variant='outlined'
                  onBlur={formik.handleBlur}
                  onFocus={async e => formik.setFieldTouched(e.currentTarget.name as string, false)}
                  onChange={formik.handleChange}
                  onReset={formik.handleReset}
                  name={'examples'}
                  sx={{ backgroundColor: Theme.palette.background.default, borderRadius: Theme.shape.borderRadius }}
                  value={formik.values.examples}
                  slotProps={promptBuilderTextFieldSlotProps}
                />
                <FormikValidationError<IPromptInputData>
                  elementName='examples'
                  formik={formik}
                  helperTextSx={helperTextSx}
                />
              </HelperTextBox>

              <HelperTextBox multiline>
                <TextField
                  label='Constraints'
                  id='prompt-builder-constraints'
                  multiline={true}
                  fullWidth={true}
                  rows={2}
                  placeholder='Limits you want AI to adhere to'
                  variant='outlined'
                  onBlur={formik.handleBlur}
                  onFocus={async e => formik.setFieldTouched(e.currentTarget.name as string, false)}
                  onChange={formik.handleChange}
                  onReset={formik.handleReset}
                  name={'constraints'}
                  sx={{ backgroundColor: Theme.palette.background.default, borderRadius: Theme.shape.borderRadius }}
                  value={formik.values.constraints}
                  slotProps={promptBuilderTextFieldSlotProps}
                />
                <FormikValidationError<IPromptInputData>
                  elementName='constraints'
                  formik={formik}
                  helperTextSx={helperTextSx}
                />
              </HelperTextBox>
              <HelperTextBox multiline>
                <TextField
                  label='Tone'
                  id='prompt-builder-tone'
                  multiline={true}
                  fullWidth={true}
                  rows={2}
                  placeholder='The style, voice, mood, feeling you want the AI to convey'
                  variant='outlined'
                  onBlur={formik.handleBlur}
                  onFocus={async e => formik.setFieldTouched(e.currentTarget.name as string, false)}
                  onChange={formik.handleChange}
                  onReset={formik.handleReset}
                  name={'tone'}
                  sx={{ backgroundColor: Theme.palette.background.default, borderRadius: Theme.shape.borderRadius }}
                  value={formik.values.tone}
                  slotProps={promptBuilderTextFieldSlotProps}
                />
                <FormikValidationError<IPromptInputData>
                  elementName='tone'
                  formik={formik}
                  helperTextSx={helperTextSx}
                />
              </HelperTextBox>

              <HelperTextBox multiline>
                <TextField
                  label='Response Instructions'
                  id='prompt-builder-response-instructions'
                  multiline={true}
                  fullWidth={true}
                  rows={2}
                  placeholder='The how AI will respond'
                  variant='outlined'
                  onBlur={formik.handleBlur}
                  onFocus={async e => formik.setFieldTouched(e.currentTarget.name as string, false)}
                  onChange={formik.handleChange}
                  onReset={formik.handleReset}
                  name={'responseInstructions'}
                  sx={{ backgroundColor: Theme.palette.background.default, borderRadius: Theme.shape.borderRadius }}
                  value={formik.values.responseInstructions}
                  slotProps={promptBuilderTextFieldSlotProps}
                />
                <FormikValidationError<IPromptInputData>
                  elementName='responseIsnstructions'
                  formik={formik}
                  helperTextSx={helperTextSx}
                />
              </HelperTextBox>

              <Box
                component={'section'}
                key={'prompt-builder-response-format-box'}
                id='prompt-builder-response-format-box'
                sx={{}}
              >
                <Label
                  id='response-format-label'
                  htmlFor='prompt-builder-response-format'
                  tooltipTitle=''
                  tooltipSx={{}}
                  labelVariant='h4'
                  labelTextSx={promptBuilderResponseFormatLabelSxProps}
                  labelText='Response Format'
                  placement='top'
                />
                <Box
                  component={'section'}
                  key={'prompt-builder-response-format-radio-box'}
                  id='prompt-builder-response-format-radio-box'
                  sx={promptBuilderResponseFormatBoxSxProps}
                >
                  <RadioGroup
                    key={'prompt-builder-response-format'}
                    id='prompt-builder-response-format'
                    onBlur={formik.handleBlur}
                    onChange={formik.handleChange}
                    onReset={formik.handleReset}
                    value={formik.values.responseFormat}
                    name={'responseFormat'}
                    color='primary'
                    sx={promptBuilderRadioGroupSxProps}
                  >
                    <FormControlLabel
                      id='response-format-text'
                      value={ResponseType.TEXT}
                      control={<Radio />}
                      label={
                        <Label
                          id='response-format-text-label'
                          htmlFor='response-format-text'
                          tooltipTitle={'Tells the LLM to respond with plain text'}
                          labelVariant={'h4'}
                          labelText={'Text'}
                          placement={'top'}
                          Icon={<TextIcon sx={promptBuilderResponseFormatIconsSxProps} />}
                          labelWrapperDivSxProps={radioButtonLabelWrapperSxProps}
                          labelTextSx={radioButtonLabelSxProps}
                        />
                      }
                      sx={formLabelSxProps}
                    />
                    <FormControlLabel
                      id='response-format-json'
                      value={ResponseType.JSON}
                      control={<Radio />}
                      label={
                        <Label
                          id='response-format-json-label'
                          htmlFor='response-format-json'
                          tooltipTitle={'Tells the LLM to respond with JSON'}
                          labelVariant={'h4'}
                          labelText={'JSON'}
                          placement={'top'}
                          labelTextSx={radioButtonLabelSxProps}
                          labelWrapperDivSxProps={radioButtonLabelWrapperSxProps}
                          Icon={<JsonIcon sx={promptBuilderResponseFormatIconsSxProps} />}
                        />
                      }
                      sx={formLabelSxProps}
                    />
                    <FormControlLabel
                      id='response-format-image'
                      value={ResponseType.IMAGE}
                      control={<Radio />}
                      label={
                        <Label
                          id='response-format-image-label'
                          htmlFor='response-format-image'
                          tooltipTitle={
                            'Tells the LLM to respond with a text to Image format.\n**WILL NOT WORK WITH TEXT OR AUDIO**'
                          }
                          labelVariant={'h4'}
                          labelText={'Image'}
                          placement={'top'}
                          Icon={<ImageIcon sx={promptBuilderResponseFormatIconsSxProps} />}
                          labelWrapperDivSxProps={radioButtonLabelWrapperSxProps}
                          labelTextSx={radioButtonLabelSxProps}
                          tooltipSx={{ fontSize: '1rem' }}
                        />
                      }
                      sx={formLabelSxProps}
                    />
                  </RadioGroup>
                  <FormikValidationError<IPromptInputData>
                    elementName='responseFormat'
                    formik={formik}
                    helperTextSx={helperTextSx}
                  />
                </Box>
              </Box>
              <Box
                component={'span'}
                key={'prompt-builder-document-wrapper'}
                id='prompt-builder-document-wrapper'
                sx={flexColumnStyles}
              >
                <input
                  ref={fileInputRef}
                  accept={SUPPORTED_FORMATS.join(', ')}
                  id='document'
                  name='document'
                  type='file'
                  style={{ display: 'none' }}
                  onChange={() => handleFileUpload(fileInputRef, setPrompt, setFileName, setLoading)}
                  onBlur={formik.handleBlur}
                  onReset={formik.handleReset}
                />
                <Box
                  component={'section'}
                  key={'current-document-text-value'}
                  id={'current-document-text-value'}
                  sx={{ ...radioButtonLabelSxProps, alignItems: 'baseline', flex: '1 0 100%' }}
                >
                  <Text
                    key={'current-document-text-value-title'}
                    component={'h4'}
                    variant='h4'
                    children={`Uploaded File: `}
                    sx={promptBuilderUploadFileTextSxProps}
                  />
                  {loading ? null : (
                    <Text
                      component={'p'}
                      key={'current-document-text-value-text'}
                      variant='body1'
                      children={`${fileName}`}
                      sx={{ fontSize: '1.4rem' }}
                    />
                  )}
                </Box>
                <FormikValidationError<IPromptInputData>
                  elementName='document'
                  formik={formik}
                  helperTextSx={helperTextSx}
                />
              </Box>
              <Box
                component={'section'}
                key={'prompt-builder-submit-box'}
                id='prompt-builder-submit-box'
                display={'flex'}
                justifyContent={'space-evenly'}
              >
                {!action && (
                  <Button
                    variant='text'
                    type='button'
                    key={'prompt-builder-upload-file-button'}
                    id='prompt-builder-upload-file-button'
                    onClick={handleFileUploadButtonClick}
                    sx={buttonSXProps}
                  >
                    Upload File
                  </Button>
                )}
                <Button
                  variant='text'
                  type='submit'
                  key={'prompt-builder-submit-button'}
                  id='prompt-builder-submit-button'
                  sx={buttonSXProps}
                >
                  Build Prompt
                </Button>
                <Button
                  variant='text'
                  type='reset'
                  key={'prompt-builder-reset-button'}
                  id='prompt-builder-reset-button'
                  onReset={formik.handleReset}
                  sx={buttonSXProps}
                >
                  Clear Values
                </Button>
                {action && (
                  <Button
                    variant='text'
                    type='button'
                    key={'copy-and-add-to-input'}
                    id='copy-and-add-to-input'
                    onClick={() =>
                      handleCopyPromptToClipboardAndAddToInput(action, setPrompt, setOpenPromptResponse, nav)
                    }
                    sx={buttonSXProps}
                  >
                    Copy & Add to Input
                  </Button>
                )}
                {action && (
                  <Button
                    variant='text'
                    key={'open-prompt'}
                    id='open-prompt'
                    type='button'
                    onClick={() => setOpenPromptResponse(!openPromptResponse)}
                    sx={buttonSXProps}
                  >
                    {!openPromptResponse ? 'Open Prompt' : 'Close Prompt'}
                  </Button>
                )}
              </Box>
            </Box>
          </Form>
        </CenteredFlexDiv>
        {openPromptResponse && (
          <Container key={'prompt-response-container'} id={'prompt-response-container'} sx={fullSizeBlock}>
            <PromptBuilderResponse prompt={action} />
          </Container>
        )}
      </StyledCard>
    </Box>
  );
};
export default PromptBuilder;
/**
 * This function handles copying the generated prompt to the clipboard and adding it to the prompt state.
 *
 * @param {string} buildPrompt - The generated prompt.
 * @param {Dispatch<SetStateAction<PromptRequest>>} setPrompt - A function to update the prompt state.
 * @param {Dispatch<SetStateAction<boolean>>} setOpenPromptResponse - A function to close the prompt response modal.
 * @param {NavigateFunction} nav - A function to navigate to the text section.
 */
const handleCopyPromptToClipboardAndAddToInput = async (
  buildPrompt: string,
  setPrompt: Dispatch<SetStateAction<PromptRequest>>,
  setOpenPromptResponse: Dispatch<SetStateAction<boolean>>,
  nav: NavigateFunction,
) => {
  setPrompt(prev => ({ ...prev, text: buildPrompt }));
  await navigator.clipboard.writeText(buildPrompt);
  setOpenPromptResponse(false);
  nav('text');
};
const baseUrl = import.meta.env.VITE_VERTEX_API_URL;
/**
 * This function handles the file upload event.
 * It uploads the file to the server and updates the prompt state with the file data.
 *
 * @param {RefObject<HTMLInputElement | null>} fileInputRef - A ref to the file input element.
 * @param {Dispatch<SetStateAction<PromptRequest>>} setPrompt - A function to update the prompt state.
 * @param {Dispatch<SetStateAction<string>>} setFileName - A function to update the file name state.
 * @param {Dispatch<SetStateAction<boolean>>} setLoading - A function to update the loading state.
 */
export const handleFileUpload = async (
  fileInputRef: RefObject<HTMLInputElement | null>,
  setPrompt: Dispatch<SetStateAction<PromptRequest>>,
  setFileName: Dispatch<SetStateAction<string>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
) => {
  try {
    if (fileInputRef.current) {
      if (fileInputRef.current.files) {
        const file = fileInputRef.current.files[0];
        const contextPath = getContextPath('context-path');
        setLoading(true);
        const resp = await axios.post(
          `${baseUrl}/upload`,
          { file: file, contextPath: contextPath },
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );
        const { path } = resp.data as { path: string };
        setPrompt(prev => ({ ...prev, fileData: { fileUri: path, mimeType: file.type } }));
        setFileName(file.name);
        return null;
      } else return null;
    } else return null;
  } catch (error) {
    console.error(error);
    return null;
  } finally {
    setLoading(false);
  }
};
