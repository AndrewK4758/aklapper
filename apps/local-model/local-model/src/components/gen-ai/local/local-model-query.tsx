import { FormikValidationError, Label } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { useFormik } from 'formik';
import { useContext } from 'react';
import { Form } from 'react-router';
import * as Yup from 'yup';
import { WebSocketContext } from '../../../contexts/websocket-context';
import { labelSx, textInputSx, tooltipSx } from '../../../styles/gen-ai-modes-styles';
import Theme from '../../../styles/theme';

const initialValues = {
  modelTextQuery: ''
};

const validationSchema = Yup.object({
  modelTextQuery: Yup.string().required('You must provide a query to iteract with the model')
});

const ModelQuery = () => {
  const { socket } = useContext(WebSocketContext);

  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: ({ modelTextQuery }) => {
      socket.emit('modelQuery', { modelTextQuery: modelTextQuery });
      formik.resetForm({ isSubmitting: true });
    }
  });

  return (
    <Box component={'div'} key={'model-query-wrapper'} id="model-query-wrapper">
      <Box>
        <Label
          placement="top"
          tooltipTitle=""
          labelVariant="h2"
          labelText={'Local Model'}
          labelTextsx={{ ...labelSx, textAlign: 'center', width: '100%' }}
        />
      </Box>
      <Form key={'model-query-form'} id="model-query-form" onSubmit={formik.handleSubmit}>
        <Box component={'section'} key={'model-query-input-section'} id="model-query-input-section">
          <Label
            placement="top"
            tooltipTitle={'Input to query local llm'}
            labelVariant={'h4'}
            labelText={'Query Model'}
            labelTextsx={labelSx}
            tooltipSx={tooltipSx}
          />
          <TextField
            component={'span'}
            key={'model-query-input'}
            id="model-query-input"
            multiline={true}
            focused={true}
            fullWidth={true}
            rows={2}
            placeholder="Query the LLM here"
            variant="outlined"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            onReset={formik.handleReset}
            name={'modelTextQuery'}
            sx={textInputSx}
            value={formik.values.modelTextQuery}
          />
          <FormikValidationError
            elementName={'modelTextQuery'}
            formik={formik}
            helperTextSx={{ color: Theme.palette.error.main, fontSize: '1.25rem' }}
          />
        </Box>
        <Box key={'model-query-submit-box'} id="model-query-submit-box">
          <Button
            variant="text"
            type="reset"
            key={'model-query-start'}
            id="model-query-start"
            sx={{ fontSize: '2rem', float: 'left' }}
            onClick={() => formik.resetForm()}
          >
            Start Queries
          </Button>
          <Button
            variant="text"
            type="submit"
            key={'model-query-submit'}
            id="model-query-submit"
            sx={{ fontSize: '2rem', float: 'right' }}
          >
            Submit Query
          </Button>
        </Box>
      </Form>
    </Box>
  );
};

export default ModelQuery;
