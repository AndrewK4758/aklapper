import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  footerWrapperSxProps,
  headerWrapperSxProps,
  mainWrapperSxProps,
  outletWrapperSxProps
} from '../../styles/layout-styles';
import { Label, Text } from '@aklapper/react-shared';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';

export default function Layout() {
  const nav = useNavigate();
  return (
    <Box component={'div'} id="app-wrapper" data-testid="app-wrapper" key={'app-wrapper'}>
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
            >
              <Label
                tooltipTitle={'Navigate to Chat with LLM'}
                labelVariant={'button'}
                labelText={'Query Model'}
                placement={'bottom'}
                labelTextsx={{ fontSize: '2rem' }}
              />
            </Button>
          </ButtonGroup>
        </Toolbar>
      </AppBar>

      <Box component={'div'} id="main-wrapper" data-testid="main-wrapper" key={'main-wrapper'} sx={mainWrapperSxProps}>
        <Text titleText="Home Page Placeholder" titleVariant="h1" component={'h1'} />
        <Box
          component={'div'}
          id="outlet-wrapper"
          data-testid="outlet-wrapper"
          key={'outlet-wrapper'}
          sx={outletWrapperSxProps}
        >
          <Outlet />
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
