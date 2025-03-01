import { IPromptInputData, ResponseType } from '@aklapper/prompt-builder';
import { FormikValidationError, Label, Text, useScrollIntoView } from '@aklapper/react-shared';
import { getContextPath } from '@aklapper/utils';
import type { PromptRequest } from '@aklapper/vertex-ai';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import axios from 'axios';
import { useFormik } from 'formik';
import { useRef, useState, type Dispatch, type JSX, type RefObject, type SetStateAction } from 'react';
import { Form, useActionData, useNavigate, useSubmit, type NavigateFunction, type SubmitTarget } from 'react-router';
import * as Yup from 'yup';
import { crudHeaderTextSxProps } from '../../../styles/crud-styles.jsx';
import {
  formLabelSxProps,
  helperTextSx,
  labelSx,
  promptBuilderRadioGroupSxProps,
  promptBuilderResponseFormatBoxSxProps,
  promptBuilderResponseFormatIconsSxProps,
  promptBuilderResponseFormatLabelSxProps,
  promptBuilderTextFieldSlotProps,
  promptBuilderUploadFileTextSxProps,
  promptBuillderFormBoxSxProps,
  radioButtonLabelSxProps,
  textInputSx,
  tooltipSx
} from '../../../styles/gen-ai-styles.jsx';
import { buttonSXProps } from '../../../styles/header-styles.jsx';
import { flexColumnStyles, fullSizeBlock, pagesTitleSx } from '../../../styles/pages-styles.jsx';
import '../../../styles/prompt-builder.css';
import ImageIcon from '../../icons/image-icon.jsx';
import JsonIcon from '../../icons/json-icon.jsx';
import TextIcon from '../../icons/text-icon.jsx';
import {
  constraints,
  examples,
  instructions,
  objective,
  responseInstructions,
  SUPPORTED_FORMATS,
  textData,
  tone
} from '../static/definitions.jsx';
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
  responseInstructions: ''
};

const validationSchema = Yup.object({
  objective: Yup.string().required('Must have valid objective statement'),
  instructions: Yup.string(),
  textData: Yup.string(),
  examples: Yup.string(),
  constraints: Yup.string(),
  tone: Yup.string(),
  resposeFormat: Yup.string().oneOf(Object.values(ResponseType)),
  responseInstructions: Yup.string()
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
    validateOnChange: true
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
    <Box component={'div'} key={'prompt-builder-wrapper'} id="prompt-builder-wrapper" ref={divRef} width={'100%'}>
      <Paper key={'prompt-builder-paper'} id="prompt-builder-paper">
        <Container
          component={'section'}
          key={'prompt-builder'}
          id="prompt-builder"
          maxWidth={false}
          sx={{ ...flexColumnStyles, gap: 4 }}
        >
          <Box component={'section'} key={'prompt-builder-header-box'} id="prompt-builder-header-box">
            <Text component={'h2'} titleVariant="h2" titleText={'Prompt Builder'} sx={pagesTitleSx} />
            <Text component={'p'} titleVariant="body1" titleText={promptBuilderHeaderText} sx={crudHeaderTextSxProps} />
          </Box>
          <Form key={'prompt-builder-form'} method="POST" onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
            <Box
              component={'section'}
              key={'prompt-builder-input-elements-box'}
              id="prompt-builder-input-elements-box"
              sx={promptBuillderFormBoxSxProps}
            >
              <Box component={'section'} key={'prompt-builder-objective-box'} id="prompt-builder-objective-box">
                <Label
                  htmlFor="prompt-builder-objective"
                  placement="top"
                  tooltipTitle={objective}
                  labelText="Objective"
                  labelVariant="h3"
                  labelTextSx={labelSx}
                  tooltipSx={tooltipSx}
                />
                <TextField
                  component={'span'}
                  key={'prompt-builder-objective'}
                  id="prompt-builder-objective"
                  multiline={true}
                  focused={true}
                  fullWidth={true}
                  rows={2}
                  placeholder="What you want the AI todo"
                  variant="outlined"
                  onBlur={formik.handleBlur}
                  onChange={formik.handleChange}
                  onReset={formik.handleReset}
                  name={'objective'}
                  sx={textInputSx}
                  value={formik.values.objective}
                  slotProps={promptBuilderTextFieldSlotProps}
                />
                <FormikValidationError<IPromptInputData>
                  elementName="objective"
                  formik={formik}
                  helperTextSx={helperTextSx}
                />
              </Box>
              <Box component={'section'} key={'prompt-builder-instructions-box'} id="prompt-builder-instructions-box">
                <Label
                  htmlFor="prompt-builder-instructions"
                  placement="top"
                  tooltipTitle={instructions}
                  labelText="Instructions"
                  labelVariant="h3"
                  labelTextSx={labelSx}
                  tooltipSx={tooltipSx}
                />
                <TextField
                  component={'span'}
                  key={'prompt-builder-instructions'}
                  id="prompt-builder-instructions"
                  multiline={true}
                  fullWidth={true}
                  rows={2}
                  placeholder="How you want the AI to execute the objective"
                  variant="outlined"
                  onBlur={formik.handleBlur}
                  onChange={formik.handleChange}
                  onReset={formik.handleReset}
                  name={'instructions'}
                  sx={textInputSx}
                  value={formik.values.instructions}
                  slotProps={promptBuilderTextFieldSlotProps}
                />
                <FormikValidationError<IPromptInputData>
                  elementName="instructions"
                  formik={formik}
                  helperTextSx={helperTextSx}
                />
              </Box>
              <Box component={'section'} key={'prompt-builder-text-data-box'} id="prompt-builder-text-data-box">
                <Label
                  htmlFor="prompt-builder-text-data"
                  placement="top"
                  tooltipTitle={textData}
                  labelText="Text Data"
                  labelVariant="h3"
                  labelTextSx={labelSx}
                  tooltipSx={tooltipSx}
                />
                <TextField
                  component={'span'}
                  key={'prompt-builder-text-data'}
                  id="prompt-builder-text-data"
                  multiline={true}
                  fullWidth={true}
                  rows={2}
                  placeholder="Copy & Paste any simple text for context or processing"
                  variant="outlined"
                  onBlur={formik.handleBlur}
                  onChange={formik.handleChange}
                  onReset={formik.handleReset}
                  name={'textData'}
                  sx={textInputSx}
                  value={formik.values.textData}
                  slotProps={promptBuilderTextFieldSlotProps}
                />
                <FormikValidationError<IPromptInputData>
                  elementName="textData"
                  formik={formik}
                  helperTextSx={helperTextSx}
                />
              </Box>
              <Box component={'section'} key={'prompt-builder-examples-box'} id="prompt-builder-examples-box">
                <Label
                  htmlFor="prompt-builder-examples"
                  placement="top"
                  tooltipTitle={examples}
                  labelText="Examples"
                  labelVariant="h3"
                  labelTextSx={labelSx}
                  tooltipSx={tooltipSx}
                />
                <TextField
                  component={'span'}
                  key={'prompt-builder-examples'}
                  id="prompt-builder-examples"
                  multiline={true}
                  fullWidth={true}
                  rows={2}
                  placeholder="Show AI Example of your desired outcome"
                  variant="outlined"
                  onBlur={formik.handleBlur}
                  onChange={formik.handleChange}
                  onReset={formik.handleReset}
                  name={'examples'}
                  sx={textInputSx}
                  value={formik.values.examples}
                  slotProps={promptBuilderTextFieldSlotProps}
                />
                <FormikValidationError<IPromptInputData>
                  elementName="examples"
                  formik={formik}
                  helperTextSx={helperTextSx}
                />
              </Box>
              <Box component={'section'} key={'prompt-builder-constraints-box'} id="prompt-builder-constraints-box">
                <Label
                  htmlFor="prompt-builder-constraints"
                  placement="top"
                  tooltipTitle={constraints}
                  labelText="Constraints"
                  labelVariant="h3"
                  labelTextSx={labelSx}
                  tooltipSx={tooltipSx}
                />
                <TextField
                  component={'span'}
                  key={'prompt-builder-constraints'}
                  id="prompt-builder-constraints"
                  multiline={true}
                  fullWidth={true}
                  rows={2}
                  placeholder="Limits you want AI to adhere to"
                  variant="outlined"
                  onBlur={formik.handleBlur}
                  onChange={formik.handleChange}
                  onReset={formik.handleReset}
                  name={'constraints'}
                  sx={textInputSx}
                  value={formik.values.constraints}
                  slotProps={promptBuilderTextFieldSlotProps}
                />
                <FormikValidationError<IPromptInputData>
                  elementName="constraints"
                  formik={formik}
                  helperTextSx={helperTextSx}
                />
              </Box>
              <Box component={'section'} key={'prompt-builder-tone-box'} id="prompt-builder-tone-box">
                <Label
                  htmlFor="prompt-builder-tone"
                  placement="top"
                  tooltipTitle={tone}
                  labelText="Tone"
                  labelVariant="h3"
                  labelTextSx={labelSx}
                  tooltipSx={tooltipSx}
                />
                <TextField
                  component={'span'}
                  key={'prompt-builder-tone'}
                  id="prompt-builder-tone"
                  multiline={true}
                  fullWidth={true}
                  rows={2}
                  placeholder="The style, voice, mood, feeling you want the AI to convey"
                  variant="outlined"
                  onBlur={formik.handleBlur}
                  onChange={formik.handleChange}
                  onReset={formik.handleReset}
                  name={'tone'}
                  sx={textInputSx}
                  value={formik.values.tone}
                  slotProps={promptBuilderTextFieldSlotProps}
                />
                <FormikValidationError<IPromptInputData>
                  elementName="tone"
                  formik={formik}
                  helperTextSx={helperTextSx}
                />
              </Box>
              <Box
                component={'section'}
                key={'prompt-builder-response-instructions-box'}
                id="prompt-builder-response-instructions-box"
              >
                <Label
                  htmlFor="prompt-builder-response-instructions"
                  placement="top"
                  tooltipTitle={responseInstructions}
                  labelText="Response Instructions"
                  labelVariant="h3"
                  labelTextSx={labelSx}
                  tooltipSx={tooltipSx}
                />
                <TextField
                  component={'span'}
                  key={'prompt-builder-response-instructions'}
                  id="prompt-builder-response-instructions"
                  multiline={true}
                  fullWidth={true}
                  rows={2}
                  placeholder="The how AI will respond"
                  variant="outlined"
                  onBlur={formik.handleBlur}
                  onChange={formik.handleChange}
                  onReset={formik.handleReset}
                  name={'responseInstructions'}
                  sx={textInputSx}
                  value={formik.values.responseInstructions}
                  slotProps={promptBuilderTextFieldSlotProps}
                />
                <FormikValidationError<IPromptInputData>
                  elementName="responseIsnstructions"
                  formik={formik}
                  helperTextSx={helperTextSx}
                />
              </Box>
              <Box
                component={'section'}
                key={'prompt-builder-response-format-box'}
                id="prompt-builder-response-format-box"
                sx={{}}
              >
                <Label
                  htmlFor=""
                  tooltipTitle=""
                  tooltipSx={{}}
                  labelVariant="h4"
                  labelTextSx={promptBuilderResponseFormatLabelSxProps}
                  labelText="Response Format"
                  placement="top"
                />
                <Box
                  component={'section'}
                  key={'prompt-builder-response-format-radio-box'}
                  id="prompt-builder-response-format-radio-box"
                  sx={promptBuilderResponseFormatBoxSxProps}
                >
                  <RadioGroup
                    key={'prompt-builder-response-format'}
                    id="prompt-builder-response-format"
                    onBlur={formik.handleBlur}
                    onChange={formik.handleChange}
                    onReset={formik.handleReset}
                    value={formik.values.responseFormat}
                    name={'responseFormat'}
                    color="primary"
                    sx={promptBuilderRadioGroupSxProps}
                  >
                    <FormControlLabel
                      value={ResponseType.TEXT}
                      control={<Radio />}
                      label={
                        <Label
                          htmlFor=""
                          tooltipTitle={undefined}
                          labelVariant={'h4'}
                          labelText={'Text'}
                          placement={undefined}
                          Icon={<TextIcon sx={promptBuilderResponseFormatIconsSxProps} />}
                          labelTextSx={radioButtonLabelSxProps}
                        />
                      }
                      sx={formLabelSxProps}
                    />

                    <FormControlLabel
                      value={ResponseType.JSON}
                      control={<Radio />}
                      label={
                        <Label
                          htmlFor=""
                          tooltipTitle={undefined}
                          labelVariant={'h4'}
                          labelText={'JSON'}
                          placement={undefined}
                          labelTextSx={radioButtonLabelSxProps}
                          Icon={<JsonIcon sx={promptBuilderResponseFormatIconsSxProps} />}
                        />
                      }
                      sx={formLabelSxProps}
                    />

                    <FormControlLabel
                      value={ResponseType.IMAGE}
                      control={<Radio />}
                      label={
                        <Label
                          htmlFor=""
                          tooltipTitle={'WILL NOT WORK WITH TEXT OR AUDIO'}
                          labelVariant={'h4'}
                          labelText={'Image'}
                          placement={'top'}
                          Icon={<ImageIcon sx={promptBuilderResponseFormatIconsSxProps} />}
                          labelTextSx={radioButtonLabelSxProps}
                          tooltipSx={{ fontSize: '1rem' }}
                        />
                      }
                      sx={formLabelSxProps}
                    />
                  </RadioGroup>
                  <FormikValidationError<IPromptInputData>
                    elementName="responseFormat"
                    formik={formik}
                    helperTextSx={helperTextSx}
                  />
                </Box>
              </Box>
              <Box
                component={'span'}
                key={'prompt-builder-document-wrapper'}
                id="prompt-builder-document-wrapper"
                sx={flexColumnStyles}
              >
                <input
                  ref={fileInputRef}
                  accept={SUPPORTED_FORMATS.join(', ')}
                  id="document"
                  name="document"
                  type="file"
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
                    titleVariant="h4"
                    titleText={`Uploaded File: `}
                    sx={promptBuilderUploadFileTextSxProps}
                  />
                  {loading ? null : (
                    <Text
                      component={'p'}
                      key={'current-document-text-value-text'}
                      titleVariant="body1"
                      titleText={`${fileName}`}
                      sx={{ fontSize: '1.4rem' }}
                    />
                  )}
                </Box>

                <FormikValidationError<IPromptInputData>
                  elementName="document"
                  formik={formik}
                  helperTextSx={helperTextSx}
                />
              </Box>

              <Box
                component={'section'}
                key={'prompt-builder-submit-box'}
                id="prompt-builder-submit-box"
                display={'flex'}
                justifyContent={'space-evenly'}
              >
                {!action && (
                  <Button
                    variant="text"
                    type="button"
                    key={'prompt-builder-upload-file-button'}
                    id="prompt-builder-upload-file-button"
                    onClick={handleFileUploadButtonClick}
                    sx={buttonSXProps}
                  >
                    Upload File
                  </Button>
                )}
                <Button
                  variant="text"
                  type="submit"
                  key={'prompt-builder-submit-button'}
                  id="prompt-builder-submit-button"
                  sx={buttonSXProps}
                >
                  Build Prompt
                </Button>
                <Button
                  variant="text"
                  type="reset"
                  key={'prompt-builder-reset-button'}
                  id="prompt-builder-reset-button"
                  onReset={formik.handleReset}
                  sx={buttonSXProps}
                >
                  Clear Values
                </Button>
                {action && (
                  <Button
                    variant="text"
                    type="button"
                    key={'copy-and-add-to-input'}
                    id="copy-and-add-to-input"
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
                    variant="text"
                    key={'open-prompt'}
                    id="open-prompt"
                    type="button"
                    onClick={() => setOpenPromptResponse(!openPromptResponse)}
                    sx={buttonSXProps}
                  >
                    {!openPromptResponse ? 'Open Prompt' : 'Close Prompt'}
                  </Button>
                )}
              </Box>
            </Box>
          </Form>
        </Container>
        {openPromptResponse && (
          <Container key={'prompt-response-container'} id={'prompt-response-container'} sx={fullSizeBlock}>
            <PromptBuilderResponse prompt={action} />
          </Container>
        )}
      </Paper>
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
  nav: NavigateFunction
) => {
  setPrompt(prev => ({ ...prev, text: buildPrompt }));
  await navigator.clipboard.writeText(buildPrompt);
  setOpenPromptResponse(false);
  nav('text');
};

const baseUrl = import.meta.env.VITE_VERTEX_API_URL;
console.log(baseUrl);
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
  setLoading: Dispatch<SetStateAction<boolean>>
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
          { headers: { 'Content-Type': 'multipart/form-data' } }
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
