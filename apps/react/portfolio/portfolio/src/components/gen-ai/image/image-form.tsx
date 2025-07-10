import { CenteredFlexDiv, StyledCard, Text, TextInput } from '@aklapper/react-shared';
import { AspectRatio } from '@aklapper/types';
import { type ClientImagenConfig } from '@aklapper/vertex-ai';
import Box from '@mui/material-pigment-css/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Input from '@mui/material/Input';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import { useFormik, type FormikProps } from 'formik';
import { type ChangeEvent, type ReactElement } from 'react';
import { Form, useOutletContext, useSubmit } from 'react-router';
import * as Yup from 'yup';
import handleFormikBlur from '../../../services/actions/crud-actions/handle_formik_blur';
import Theme from '../../../styles/themes/theme';
import type { OutletContextProps } from '../../../types/types';
import AnimatedBorderBox from '../../styled/animated_border_box';

const validationSchema = Yup.object({
  prompt: Yup.string().required('The prompt is required'),
  sampleCount: Yup.number().required('Sample Count is required'),
  seed: Yup.number().required('Seed is required'),
  aspectRatio: Yup.string().oneOf(Object.values(AspectRatio)),
});

/**
 * This component renders a form for generating images using the generative AI model.
 * It allows users to input a prompt, select the number of images to generate, choose the aspect ratio, and set a seed value.
 *
 * @returns {ReactElement} The rendered ImageForm component.
 */

const ImageForm = (): ReactElement => {
  const { chatHistory } = useOutletContext<OutletContextProps>();
  const submit = useSubmit();

  const lastPrompt = chatHistory[chatHistory.length - 1] ?? null;

  const initialValues: ClientImagenConfig = {
    prompt: lastPrompt ? lastPrompt.prompt : '',
    sampleCount: 1,
    seed: 100,
    aspectRatio: AspectRatio['1:1'],
  };

  const formik = useFormik<ClientImagenConfig>({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async values =>
      await submit(JSON.stringify(values), { encType: 'application/json', relative: 'route', method: 'post' }),
  });

  return (
    <Box id='image-gen-wrapper' sx={{ width: '100%', padding: Theme.spacing(4) }}>
      <Form
        method='post'
        id='image-form'
        onSubmit={formik.handleSubmit}
        onReset={formik.handleReset}
        style={{ width: '100%' }}
      >
        <TextInput<ClientImagenConfig>
          id='image-prompt-input'
          formik={formik}
          name={'prompt'}
          label={'Prompt'}
          variant={'outlined'}
          multiline={true}
          handleBlur={handleFormikBlur}
          slotProps={{ input: { sx: { backgroundColor: Theme.palette.background.paper } } }}
        />

        <StyledCard>
          <CenteredFlexDiv sx={{ padding: Theme.spacing(4), gap: Theme.spacing(3) }}>
            <Box sx={{ display: 'flex', gap: Theme.spacing(4), width: '100%' }}>
              <CenteredFlexDiv as={'section'} id='image-form-sample-count-box' sx={{ flex: 1, gap: 0, p: 0 }}>
                <FormLabel
                  component={'h5'}
                  id='image-form-sample-count-label'
                  htmlFor='image-form-sample-count-box'
                  sx={{ flex: 1, m: 0, color: Theme.palette.text.primary }}
                >
                  Sample Count
                </FormLabel>
                <RadioGroup
                  key={'image-form-sample-count'}
                  id='image-form-sample-count'
                  onBlur={formik.handleBlur}
                  onChange={(e, newValue) => handleFormikValueChange(e.target.name, newValue, formik)}
                  onReset={formik.handleReset}
                  value={formik.values.sampleCount}
                  name={'sampleCount'}
                  sx={{ display: 'flex', flexDirection: 'row', flex: 1, color: Theme.palette.text.secondary }}
                >
                  <FormControlLabel value={1} control={<Radio />} label={<Text variant='h5' children={1} />} />
                  <FormControlLabel value={2} control={<Radio />} label={<Text variant='h5' children={2} />} />
                  <FormControlLabel value={3} control={<Radio />} label={<Text variant='h5' children={3} />} />
                  <FormControlLabel value={4} control={<Radio />} label={<Text variant='h5' children={4} />} />
                </RadioGroup>
              </CenteredFlexDiv>
              <Divider flexItem orientation='vertical' />
              <CenteredFlexDiv
                as={'section'}
                id='image-form-aspect-ratio-box'
                sx={{ flex: 1, gap: Theme.spacing(4), p: 0 }}
              >
                <FormLabel
                  component={'h5'}
                  id='image-aspect-ratio-input-label'
                  htmlFor='image-aspect-ratio-input'
                  sx={{ flex: 1, m: 0, color: Theme.palette.text.primary }}
                >
                  Aspect Ratio
                </FormLabel>

                <Select
                  id='image-aspect-ratio-input'
                  rows={2}
                  variant='outlined'
                  onBlur={formik.handleBlur}
                  onChange={formik.handleChange}
                  onReset={formik.handleReset}
                  name={'aspectRatio'}
                  value={formik.values.aspectRatio}
                >
                  <MenuItem value={AspectRatio['1:1']}>{AspectRatio['1:1']}</MenuItem>
                  <MenuItem value={AspectRatio['3:4']}>{AspectRatio['3:4']}</MenuItem>
                  <MenuItem value={AspectRatio['4:3']}>{AspectRatio['4:3']}</MenuItem>
                  <MenuItem value={AspectRatio['16:9']}>{AspectRatio['16:9']}</MenuItem>
                  <MenuItem value={AspectRatio['9:16']}>{AspectRatio['9:16']}</MenuItem>
                </Select>
              </CenteredFlexDiv>
              <Divider flexItem orientation='vertical' />
              <CenteredFlexDiv sx={{ p: 0, justifyContent: 'space-between', width: '33%', gap: 0 }}>
                <FormLabel
                  id='seed-input-label'
                  htmlFor='seed'
                  component={'h5'}
                  sx={{ m: 0, color: Theme.palette.text.primary }}
                >
                  Seed
                </FormLabel>
                <Box sx={{ display: 'flex', width: '100%', gap: Theme.spacing(6) }}>
                  <Box sx={{ flex: '1 0 80%' }}>
                    <Slider
                      id='seed-slider'
                      name='seed'
                      value={formik.values.seed}
                      onChange={(_, newValue) => handleFormikValueChange('seed', newValue, formik)}
                      aria-labelledby='seed-input'
                    />
                  </Box>
                  <Box sx={{ flex: '0 1 20%' }}>
                    <Input
                      id='seed-input'
                      readOnly={true}
                      error={formik.values.seed > 100}
                      value={formik.values.seed}
                      onChange={e => handleSliderInputChange(e, formik)}
                      sx={{ height: 'fit-content' }}
                      slotProps={{
                        input: { sx: { textAlign: 'center' } },
                      }}
                    />
                  </Box>
                </Box>
              </CenteredFlexDiv>
            </Box>

            <AnimatedBorderBox sx={{ width: '100%' }}>
              <ButtonGroup id='image-gen-button-box'>
                <Button type='submit' id='gen-image-submit-button'>
                  Generate Image
                </Button>
                <Button type='reset' id='gen-image-reset-button'>
                  Reset Form
                </Button>
              </ButtonGroup>
            </AnimatedBorderBox>
          </CenteredFlexDiv>
        </StyledCard>
      </Form>
    </Box>
  );
};

export default ImageForm;

/**
 * This function handles the seed input change event.
 * It updates the seed value in the Formik state.
 *
 * @param {ChangeEvent<HTMLInputElement | HTMLTextAreaElement>} event - The change event object.
 * @param {FormikProps<ClientImagenConfig>} formik - The Formik props object.
 */

const handleSliderInputChange = (
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  formik: FormikProps<ClientImagenConfig>,
) => {
  formik.setFieldValue('seed', event.target.value === '' ? 0 : parseInt(event.target.value, 10));
};

/**
 * This function handles the Formik value change event.
 * It updates the corresponding value in the Formik state.
 *
 * @param {string} name - The name of the input field.
 * @param {string | number | number[]} value - The new value of the input field.
 * @param {FormikProps<ClientImagenConfig>} formik - The Formik props object.
 */

const handleFormikValueChange = async (
  name: string,
  value: string | number | number[],
  formik: FormikProps<ClientImagenConfig>,
) => {
  await formik.setFieldValue(name, value);
};
