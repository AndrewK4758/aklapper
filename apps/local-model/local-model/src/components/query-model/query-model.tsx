import { Label } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Container from '@mui/material/Container';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import axios from 'axios';
import { useFormik } from 'formik';
import type { Dispatch, SetStateAction } from 'react';
import { Form, useLoaderData, useOutletContext } from 'react-router';

type QueryFormValues = {
  model: string;
  query: string;
};

const initialValues: QueryFormValues = {
  model: '',
  query: ''
};

type OutletContext = {
  promptResponse: string[];
  setPromptResponse: Dispatch<SetStateAction<string[]>>;
};

export default function QueryModel() {
  const { setPromptResponse } = useOutletContext<OutletContext>();
  const modelList: string[] = useLoaderData();

  const formik = useFormik({
    initialValues: initialValues,
    onSubmit: async values => await handleQueryModel(values, setPromptResponse)
  });

  return (
    <Box
      id="query-model-wrapper"
      data-testid="query-model-wrapper"
      key={'query-model-wrapper'}
      sx={{ width: '100%', flex: 1, display: 'flex' }}
    >
      <Form
        method="POST"
        encType="application/x-www-form-urlencoded"
        id="query-model-form"
        data-testid="query-model-form"
        key={'query-model-form'}
        onSubmit={formik.handleSubmit}
        style={{ flex: 1, display: 'flex' }}
      >
        <Container
          id="query-model-container"
          data-testid="query-model-container"
          key={'query-model-container'}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignContent: 'center',
            justifyContent: 'center',
            width: '100%',
            gap: 2
          }}
        >
          <Box
            id="query-model-select-model-box"
            data-testid="query-model-select-model-box"
            key={'query-model-select-model-box'}
          >
            <TextField
              autoFocus={true}
              select={true}
              id="query-model-model-select"
              data-testid="query-model-model-select"
              key={'query-model-model-select'}
              name="model"
              variant="outlined"
              onChange={formik.handleChange}
              label={
                <Label
                  tooltipTitle={'Select model to use'}
                  labelVariant={'overline'}
                  labelText={'Model'}
                  placement={'top'}
                />
              }
              sx={{ width: '50%' }}
            >
              {modelList.map((model: string, _i: number, _arr: string[]) => (
                <MenuItem id={model} data-testid={model} key={model} value={model}>
                  {model}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box
            id="query-model-text-input-box"
            data-testid="query-model-text-input-box"
            key={'query-model-text-input-box'}
          >
            <TextField
              fullWidth={true}
              autoFocus={true}
              id="query-model-text-input"
              data-testid="query-model-text-input"
              key={'query-model-text-input'}
              name="query"
              multiline={true}
              rows={2}
              onChange={formik.handleChange}
              label={
                <Label
                  tooltipTitle={'Query & Chat with local LLM Model'}
                  labelVariant={'overline'}
                  labelText={'Query'}
                  placement={'top'}
                />
              }
            />
          </Box>
          <ButtonGroup fullWidth={true}>
            <Button id="query-model-reset" data-testid="query-model-reset" key={'query-model-reset'} type="reset">
              <Label
                tooltipTitle={'Reset Query Box'}
                labelVariant={'button'}
                labelText={'Clear Form'}
                placement={'top'}
              />
            </Button>
            <Button id="query-model-button" data-testid="query-model-button" key={'query-model-button'} type="submit">
              <Label
                tooltipTitle={'Submit Query to local LLM Model'}
                labelVariant={'button'}
                labelText={'Query Model'}
                placement={'top'}
              />
            </Button>
          </ButtonGroup>
        </Container>
      </Form>
    </Box>
  );
}

const baseUrl = import.meta.env.VITE_LOCAL_SERVER_URL;

const handleQueryModel = async (values: QueryFormValues, setPromptResponse: Dispatch<SetStateAction<string[]>>) => {
  try {
    const { model, query } = values;
    
    const resp = await axios.post(
      `${baseUrl}/query-model`,
      { model: model, query: query },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const { query_response } = resp.data;

    setPromptResponse(query_response);
  } catch (error) {
    console.error(error);
  }
};
