import { Form } from 'react-router-dom';
import { Label } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import { useFormik } from 'formik';
import axios from 'axios';
import ButtonGroup from '@mui/material/ButtonGroup';

const initialValues = {
  query: ''
};

export default function QueryModel() {
  const formik = useFormik({
    initialValues: initialValues,
    onSubmit: async ({ query }) => await handleQueryModel(query)
  });

  return (
    <Box
      id="query-model-wrapper"
      data-testid="query-model-wrapper"
      key={'query-model-wrapper'}
      sx={{ width: '100%', flex: 1, display: 'flex', border: '5px solid red' }}
    >
      <Form
        method="POST"
        encType="application/x-www-form-urlencoded"
        id="query-model-form"
        data-testid="query-model-form"
        key={'query-model-form'}
        onSubmit={formik.handleSubmit}
        style={{ flex: 1, display: 'flex', border: '5px solid blue' }}
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
            border: '5px solid green',
            width: '100%'
          }}
        >
          <Box
            id="query-model-text-input-box"
            data-testid="query-model-text-input-box"
            key={'query-model-text-input-box'}
            sx={{ border: 4 }}
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
              label={
                <Label
                  tooltipTitle={'Query & Chat with local LLM Model'}
                  labelVariant={'overline'}
                  labelText={'Query'}
                  placement={'top'}
                />
              }
              onChange={formik.handleChange}
            />
          </Box>
          <ButtonGroup fullWidth={true} sx={{ border: '5px solid orange' }}>
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
console.log(baseUrl);

const handleQueryModel = async (query: string) => {
  try {
    console.log(query);
    const resp = await axios.post(
      `${baseUrl}/query-model`,
      { query: query },
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log(resp);
  } catch (error) {
    console.error(error);
  }
};
