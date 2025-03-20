import { Label, Text, useScrollIntoView, Waiting } from '@aklapper/react-shared';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Toolbar from '@mui/material/Toolbar';
import { lazy, Suspense, useRef, useState, type Dispatch, type JSX, type SetStateAction } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext, type NavigateFunction } from 'react-router';
import waiting from '../../assets/swirly-dots-to-chrome.webp';
import { crudAppWrapperStyles, crudHeaderTextSxProps, crudPaperSxProps } from '../../styles/crud-styles.jsx';
import { gamesButtonLabelsSxProps } from '../../styles/games-styles';
import {
  buttonSXProps,
  headerModalButtonStyles,
  modalButtonBoxStyles,
  pagesTitlesBoxStyles,
  pagesTitleSx,
  pagesToolbarStyles,
  pagesWrapperStyles
} from '../../styles/pages-styles.jsx';
import type { OutletContextProps } from '../../types/types.tsx';
import { body, title } from '../static/crud-text.jsx';

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
  const { loading, setLoading } = useOutletContext<OutletContextProps>();
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
                color="primary"
              >
                <Button
                  LinkComponent={'button'}
                  key={'crud-home-button'}
                  id="crud-home-button"
                  variant="text"
                  onClick={() => nav('/crud', { replace: true })}
                  sx={buttonSXProps}
                >
                  <Label
                    htmlFor="crud-home-button"
                    tooltipTitle={
                      <pre>
                        {
                          'Clicking the button executes the following actions: \n- Starts the Chutes & Ladders instance\n- Registers 2 "Guest" Players\n- Automatically starts the game'
                        }
                      </pre>
                    }
                    labelVariant={'button'}
                    labelText={'Home'}
                    placement={'top'}
                    labelTextSx={gamesButtonLabelsSxProps}
                    id={'crud-home-label'}
                  />
                </Button>
                <Button
                  LinkComponent={'button'}
                  key={'crud-artists-button'}
                  disabled={loading}
                  id="crud-artists-button"
                  type="submit"
                  variant="text"
                  onClick={() => handleNavigate('artists', nav, setLoading)}
                  sx={buttonSXProps}
                >
                  <Label
                    htmlFor="crud-artists-button"
                    tooltipTitle={
                      <pre>
                        {
                          'Clicking the button executes the following actions: \n- Starts the Chutes & Ladders instance\n- Registers 2 "Guest" Players\n- Automatically starts the game'
                        }
                      </pre>
                    }
                    labelVariant={'button'}
                    labelText={'All Artists'}
                    placement={'top'}
                    labelTextSx={gamesButtonLabelsSxProps}
                    id={'crud-artists-label'}
                  />
                </Button>
                <Button
                  LinkComponent={'button'}
                  key={'crud-albums-button'}
                  id="crud-albums-button"
                  disabled={loading}
                  type="submit"
                  variant="text"
                  onClick={() => handleNavigate('albums', nav, setLoading)}
                  sx={buttonSXProps}
                >
                  <Label
                    htmlFor="crud-albums-button"
                    tooltipTitle={
                      <pre>
                        {
                          'Clicking the button executes the following actions: \n- Starts the Chutes & Ladders instance\n- Registers 2 "Guest" Players\n- Automatically starts the game'
                        }
                      </pre>
                    }
                    labelVariant={'button'}
                    labelText={'All Albums'}
                    placement={'top'}
                    labelTextSx={gamesButtonLabelsSxProps}
                    id={'crud-albums-label'}
                  />
                </Button>
                <Button
                  LinkComponent={'button'}
                  key={'crud-add-entry-button'}
                  id="crud-add-entry-button"
                  disabled={loading}
                  type="submit"
                  variant="text"
                  onClick={() => handleNavigate('add-entry', nav, setLoading)}
                  sx={buttonSXProps}
                >
                  <Label
                    htmlFor="crud-add-entry-button"
                    tooltipTitle={
                      <pre>
                        {
                          'Clicking the button executes the following actions: \n- Starts the Chutes & Ladders instance\n- Registers 2 "Guest" Players\n- Automatically starts the game'
                        }
                      </pre>
                    }
                    labelVariant={'button'}
                    labelText={'Add Entry'}
                    placement={'top'}
                    labelTextSx={gamesButtonLabelsSxProps}
                    id={'crud-add-entry-label'}
                  />
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
      <Suspense fallback={<Waiting src={waiting} />}>{open && <Search setOpen={setOpen} />}</Suspense>

      <Box component={'div'} key={`crud-app-wrapper`} id={`crud-app-wrapper`} sx={crudAppWrapperStyles}>
        {loading && <Waiting src={waiting} />}
        <Outlet context={{ loading, setLoading }} />
      </Box>
    </Box>
  );
};

export default Crud;

async function handleNavigate(path: string, nav: NavigateFunction, setLoading: Dispatch<SetStateAction<boolean>>) {
  try {
    setLoading(true);
    await nav(path, { relative: 'route' });
  } catch (error) {
    console.error(error);
    await nav('/crud');
    setLoading(false);
  }
}
