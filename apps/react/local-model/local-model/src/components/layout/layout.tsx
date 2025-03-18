import { Label, Text } from '@aklapper/react-shared';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Toolbar from '@mui/material/Toolbar';
import axios from 'axios';
import { useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { Outlet, useNavigate } from 'react-router';
import {
  baseStyleForLayoutItems,
  footerWrapperSxProps,
  headerWrapperSxProps,
  mainWrapperSxProps,
  outletWrapperSxProps
} from '../../styles/layout-styles';
import ModelResponse from '../query-model/query-model-response';

export default function Layout() {
  const [promptResponse, setPromptResponse] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();

  function handleUploadClick(e: MouseEvent<HTMLButtonElement, globalThis.MouseEvent>) {
    e.stopPropagation();
    if (inputRef.current) {
      inputRef.current.click();
    }
  }

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    if (e.currentTarget.files) {
      const baseUrl = import.meta.env.VITE_LOCAL_SERVER_URL;
      const formData = new FormData();
      const fileList = e.currentTarget.files;

      for (let i = 0; i < fileList.length; i++) {
        formData.append('files', fileList[i]);
      }

      const resp = await axios.postForm(baseUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log(resp);
    }
  }

  return (
    <Box component={'div'} id="app-wrapper" data-testid="app-wrapper" key={'app-wrapper'} sx={baseStyleForLayoutItems}>
      <AppBar
        component={'div'}
        id="header-wrapper"
        data-testid="header-wrapper"
        key={'header-wrapper'}
        sx={headerWrapperSxProps}
      >
        <Toolbar component={'div'} id="header-navbar" data-testid="header-navbar" key={'header-navbar'}>
          <ButtonGroup fullWidth={true}>
            <Button
              color="inherit"
              id="navbar-button-chat"
              data-testid="navbar-button-chat"
              key={'navbar-button-chat'}
              onClick={() => nav('query-model')}
              sx={{ flex: '0 1 33%' }}
            >
              <Label
                htmlFor="navbar-button-chat"
                tooltipTitle={'Navigate to Chat with LLM'}
                labelVariant={'body1'}
                labelText={'Query Model'}
                placement={'bottom'}
                labelTextSx={{ fontSize: '2rem' }}
              />
            </Button>
          </ButtonGroup>
        </Toolbar>
      </AppBar>

      <Box component={'div'} id="main-wrapper" data-testid="main-wrapper" key={'main-wrapper'} sx={mainWrapperSxProps}>
        <Text
          titleText="AI Chatbot w/ RAG, Web Search, and History"
          titleVariant="h1"
          component={'h1'}
          sx={{ fontSize: '3rem' }}
        />
        <input type="file" multiple={true} ref={inputRef} hidden={true} id="upload-files" onChange={handleFileUpload} />
        <Button type="button" onClick={handleUploadClick}>
          <Label tooltipTitle="" labelText="Upload" placement="top" htmlFor="upload-files" labelVariant={'button'} />
        </Button>
        <Box
          component={'div'}
          id="outlet-wrapper"
          data-testid="outlet-wrapper"
          key={'outlet-wrapper'}
          sx={outletWrapperSxProps}
        >
          <Outlet context={{ promptResponse, setPromptResponse }} />
        </Box>
        <Box
          component={'div'}
          id="prompt-response-wrapper"
          data-testid="prompt-response-wrapper"
          key={'prompt-response-wrapper'}
          sx={outletWrapperSxProps}
        >
          <ModelResponse promptResponse={promptResponse} />
        </Box>
      </Box>
      <Box
        component={'div'}
        id="footer-wrapper"
        data-testid="footer-wrapper"
        key={'footer-wrapper'}
        sx={footerWrapperSxProps}
      >
        Footer
      </Box>
    </Box>
  );
}
