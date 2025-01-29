import { Text, useScrollIntoView, Waiting } from '@aklapper/react-shared';
import { Collapse } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Toolbar from '@mui/material/Toolbar';
import { lazy, Suspense, useRef, useState, type JSX } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import waiting from '../../assets/swirly-dots-to-chrome.webp';
import {
  crudAppWrapperStyles,
  crudButtonSxProps,
  crudHeaderTextSxProps,
  crudPaperSxProps
} from '../../styles/crud-styles';
import {
  headerModalButtonStyles,
  modalButtonBoxStyles,
  pagesTitlesBoxStyles,
  pagesTitleSx,
  pagesToolbarStyles,
  pagesWrapperStyles
} from '../../styles/pages-styles';
import { body, title } from '../static/crud-text';

const Search = lazy(() => import('../../components/crud/search.jsx'));

export type PaginationModel = {
  pageSize: number;
  page: number;
};

export type QueryOptions = {
  cursor: number;
  pageSize: number;
  skip: number;
};

/**
 * This component renders the CRUD (Create, Read, Update, Delete) section of the application.
 * It provides an interface for users to interact with the database, including viewing, adding, updating, and deleting records.
 *
 * @returns {JSX.Element} The rendered CRUD component.
 */

const Crud = (): JSX.Element => {
  const [open, setOpen] = useState<boolean>(false);
  const divRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const nav = useNavigate();

  useScrollIntoView(divRef);

  return (
    <Box ref={divRef} component={'div'} key={'crud-wrapper'} id="crud-wrapper" sx={pagesWrapperStyles}>
      <Paper elevation={2} component={'div'} key={'crud-header-wrapper'} id="crud-header-wrapper" sx={crudPaperSxProps}>
        <Box component={'section'} key={'crud-title-wrapper'} id="crud-title-wrapper" sx={pagesTitlesBoxStyles}>
          <Text component={'h3'} titleVariant="h3" titleText={title} sx={pagesTitleSx} />
        </Box>
        <Container
          component={'div'}
          id="crud-navbar-container"
          key={'crud-navbar-container'}
          maxWidth={false}
          sx={{ paddingBottom: 2 }}
        >
          <AppBar
            component={'div'}
            id="crud-navbar-wrapper"
            key={'crud-navbar-wrapper'}
            elevation={0}
            position="static"
            sx={{ borderRadius: 1 }}
          >
            <Toolbar component={'nav'} id="crud-navbar" key={'crud-navbar'} sx={pagesToolbarStyles}>
              <ButtonGroup
                id="crud-navbar-button-group"
                key={'crud-navbar-button-group'}
                fullWidth={true}
                color="inherit"
              >
                <Button
                  LinkComponent={'button'}
                  key={'crud-home-button'}
                  id="crud-home-button"
                  variant="text"
                  color="inherit"
                  onClick={() => nav('/crud')}
                  sx={crudButtonSxProps}
                >
                  Home
                </Button>
                <Button
                  LinkComponent={'button'}
                  key={'crud-artists-button'}
                  id="crud-artists-button"
                  type="submit"
                  variant="text"
                  color="inherit"
                  onClick={() => nav('artists')}
                  sx={crudButtonSxProps}
                >
                  All Artists
                </Button>
                <Button
                  LinkComponent={'button'}
                  key={'crud-albums-button'}
                  id="crud-albums-button"
                  type="submit"
                  variant="text"
                  color="inherit"
                  onClick={() => nav('albums')}
                  sx={crudButtonSxProps}
                >
                  All Albums
                </Button>
                <Button
                  LinkComponent={'button'}
                  key={'crud-add-entry-button'}
                  id="crud-add-entry-button"
                  type="submit"
                  variant="text"
                  color="inherit"
                  onClick={() => nav('add-entry')}
                  sx={crudButtonSxProps}
                >
                  Add Entry
                </Button>
              </ButtonGroup>
            </Toolbar>
          </AppBar>
        </Container>
        <Collapse in={pathname === '/crud'}>
          <Container
            component={'div'}
            key={'crud-header-text-wrapper'}
            id="crud-header-text-wrapper"
            maxWidth={false}
            sx={{ paddingY: 2 }}
          >
            <Text
              key={'crud-header-text'}
              id="crud-header-text"
              component={'p'}
              titleVariant="body1"
              titleText={body}
              sx={crudHeaderTextSxProps}
            />
          </Container>
        </Collapse>
        <Box key={'crud-search-button'} id={'crud-search-button'} sx={modalButtonBoxStyles}>
          {!open && (
            <Button color="secondary" variant="text" onClick={() => setOpen(!open)} sx={headerModalButtonStyles}>
              {'Search'}
            </Button>
          )}
        </Box>
      </Paper>
      <Suspense fallback={<Waiting src={waiting} />}>
        {open && <Search setOpen={setOpen} />}
        <Box component={'div'} key={`crud-app-wrapper`} id={`crud-app-wrapper`} sx={crudAppWrapperStyles}>
          <Outlet />
        </Box>
      </Suspense>
    </Box>
  );
};

export default Crud;
