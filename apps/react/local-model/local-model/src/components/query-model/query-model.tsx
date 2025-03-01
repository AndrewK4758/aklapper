import { Label } from '@aklapper/react-shared';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Container from '@mui/material/Container';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import axios from 'axios';
import { useFormik } from 'formik';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Form, useLoaderData, useOutletContext } from 'react-router';

type QueryFormValues = {
  model: string;
  query: string;
  files: FileList | null;
};

const initialValues: QueryFormValues = {
  model: '',
  query: '',
  files: null
};

type OutletContext = {
  promptResponse: string[];
  setPromptResponse: Dispatch<SetStateAction<string[]>>;
};

export default function QueryModel() {
  const { setPromptResponse } = useOutletContext<OutletContext>();
  const [loading, setLoading] = useState<boolean>(false);
  const uploadFileRef = useRef<HTMLInputElement>(null);
  const modelList: string[] = useLoaderData();
  const textFieldRef = useRef<HTMLInputElement>(null);

  const formik = useFormik({
    initialValues: initialValues,
    onSubmit: async values => await handleQueryModel(values, setPromptResponse, setLoading)
  });

  const handleClickUploadFiles = () => {
    if (uploadFileRef.current) uploadFileRef.current.click();
  };

  useEffect(() => {
    if (textFieldRef.current) {
      const inputElement = textFieldRef.current.querySelector('#query-model-text-input-textfield');
      if (inputElement && inputElement.nextElementSibling) inputElement.nextElementSibling.id = 'HIDDEN-TEXT-AREA';
    }
  }, []);

  return (
    <Box
      id="query-model-wrapper"
      data-testid="query-model-wrapper"
      key={'query-model-wrapper'}
      component={'div'}
      sx={{ width: '100%', flex: 1, display: 'flex' }}
    >
      <Form
        method="POST"
        encType="multipart/form-data"
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
          component={'div'}
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
            component={'div'}
            id="query-model-select-model-box"
            data-testid="query-model-select-model-box"
            key={'query-model-select-model-box'}
          >
            <Label
              htmlFor="query-model-model-select-input"
              tooltipTitle={'List of Available Models on your System'}
              labelVariant={'body1'}
              labelText={'Model'}
              placement={'top'}
              labelTextSx={{ width: '100%' }}
            />

            <Select
              autoFocus={true}
              id="query-model-model-select"
              is="select"
              data-testid="query-model-model-select"
              key={'query-model-model-select'}
              name="model"
              variant="outlined"
              notched={true}
              onChange={formik.handleChange}
              value={formik.values.model}
              color="primary"
              slotProps={{ input: { id: 'query-model-model-select-input' } }}
              sx={{ width: '50%' }}
              label={'Model'}
            >
              {modelList.map((model: string, _i: number, _arr: string[]) => (
                <MenuItem id={model} data-testid={model} key={model} value={model}>
                  {model}
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box
            id="query-model-text-input-box"
            data-testid="query-model-text-input-box"
            key={'query-model-text-input-box'}
          >
            <Label
              htmlFor="query-model-text-input-textfield"
              tooltipTitle={'Query & Chat with local LLM Model'}
              labelVariant={'body1'}
              labelText={'Query'}
              placement={'top'}
              labelTextSx={{}}
            />
            <TextField
              ref={textFieldRef}
              fullWidth={true}
              autoFocus={true}
              required={true}
              color="primary"
              id="query-model-text-input"
              is="input"
              data-testid="query-model-text-input"
              key={'query-model-text-input'}
              name="query"
              multiline={true}
              onChange={formik.handleChange}
              slotProps={{
                htmlInput: { id: 'query-model-text-input-textfield' }
              }}
            />
          </Box>
          <Box
            component={'div'}
            id="upload-pdfs-box"
            key="upload-pdfs-box"
            data-testid="upload-pdfs-box"
            sx={{ display: 'none' }}
          >
            <input
              type="file"
              ref={uploadFileRef}
              id="upload-pdfs-input"
              key="upload-pdfs-input"
              name="files"
              accept=".pdf"
              multiple={true}
              onChange={async e => await formik.setFieldValue(e.currentTarget.name, e.currentTarget.files as FileList)}
            />
          </Box>
          <ButtonGroup fullWidth={true} variant="contained">
            <Button
              id="query-model-reset"
              is="button"
              data-testid="query-model-reset"
              key={'query-model-reset'}
              type="reset"
              sx={{ fontSize: '1.5rem' }}
            >
              <Label
                htmlFor="query-model-reset"
                tooltipTitle={'Clears the form of all user entered data'}
                labelVariant={'button'}
                labelText={'Clear Form'}
                placement={'top'}
              />
            </Button>
            <Button
              id="query-model-button"
              is="button"
              data-testid="query-model-button"
              key={'query-model-button'}
              type="submit"
              color="primary"
              disabled={loading}
              sx={{ fontSize: '1.5rem' }}
            >
              <Label
                htmlFor={'query-model-button'}
                tooltipTitle={'Query the model for response'}
                labelVariant={'button'}
                labelText={'Query Model'}
                placement={'top'}
              />
            </Button>
            <Button
              id="upload-pdfs-button"
              is="button"
              data-testid="upload-pdfs-button"
              key="upload-pdfs-button"
              type="button"
              onClick={handleClickUploadFiles}
              sx={{ fontSize: '1.5rem' }}
            >
              <Label
                htmlFor={'upload-pdfs-button'}
                tooltipTitle={'Upload documents you wish to add to database as context for all future queries'}
                labelVariant={'button'}
                labelText={'Upload Documents'}
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

const handleQueryModel = async (
  values: QueryFormValues,
  setPromptResponse: Dispatch<SetStateAction<string[]>>,
  setLoading: Dispatch<SetStateAction<boolean>>
) => {
  try {
    setLoading(true);
    const { model, query, files } = values;
    const formData = new FormData();
    formData.append('model', model);
    formData.append('query', query);

    if (files)
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

    const resp = await axios.postForm(`${baseUrl}/query-model`, formData, {
      headers: { 'Content-Type': 'multipart-form/data' }
    });

    const query_response = resp.data;

    setPromptResponse(query_response);
  } catch (error) {
    const e = error as Error;
    console.error(e);
    const parsedError = `Error: ${e.name}\nType: ${e.message}\n`;
    let x;
    if (e.stack) {
      x = e.stack.split('at').slice(1).join('at ');
    }
    const ifErrorCallstack = `Callstack:\n${x}`;
    setPromptResponse([e.stack ? parsedError + ifErrorCallstack : parsedError]);
    setLoading(false);
  } finally {
    setLoading(false);
  }
};
