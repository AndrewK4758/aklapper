import { Label, Text, useScrollIntoView } from '@aklapper/react-shared';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Toolbar from '@mui/material/Toolbar';
import { useRef, useState, type Dispatch, type JSX, type SetStateAction } from 'react';
import { Outlet, useNavigation, useOutletContext, useSubmit, type SubmitFunction } from 'react-router';
import GameLoading from '../../components/loading/loading.jsx';
import { crudPaperSxProps } from '../../styles/crud-styles.jsx';
import { gamesButtonLabelsSxProps, gamesButtonSxProps } from '../../styles/games-styles.jsx';
import {
  gamesOutletGameWrapperSxProps,
  gamesOutletWrapperSxProps,
  pagesOutletStyles,
  pagesTitlesBoxStyles,
  pagesTitleSx,
  pagesToolbarStyles,
  pagesWrapperStyles,
} from '../../styles/pages-styles.jsx';
import type { OutletContextProps } from '../../types/types.jsx';
import { body, title } from '../static/games-text';

/**
 * This component renders the main games page, providing an interface for users to select and play different games.
 *
 * @returns {JSX.Element} The rendered Games component.
 */

const Games = (): JSX.Element => {
  const { state } = useNavigation();
  const { loading, setLoading } = useOutletContext<OutletContextProps>();
  const divRef = useRef<HTMLElement>(null);
  const [textView, setTextView] = useState<boolean>(true);
  const submit = useSubmit();

  useScrollIntoView(divRef);

  return (
    <Box ref={divRef} component={'div'} key={'games-wrapper'} id='games-wrapper' sx={pagesWrapperStyles}>
      <Paper
        elevation={2}
        component={'div'}
        key={'games-header-wrapper'}
        id='games-header-wrapper'
        sx={crudPaperSxProps}
      >
        <Box component={'section'} id='games-title-wrapper' sx={pagesTitlesBoxStyles}>
          <Text component={'h2'} titleVariant='h2' titleText={title} sx={pagesTitleSx} />
        </Box>
        <Container component={'div'} id='games-navbar-container' maxWidth={false} sx={{ paddingBottom: 2 }}>
          <AppBar component={'div'} id='games-navbar-wrapper' elevation={0} position='static' sx={{ borderRadius: 1 }}>
            <Toolbar component={'nav'} id='games-navbar' key={'games-navbar'} sx={pagesToolbarStyles}>
              <ButtonGroup id='games-button-group' key={'games-button-group'} color='primary' fullWidth={true}>
                <Button
                  LinkComponent={'button'}
                  id='Chutes-&-Ladders'
                  variant='text'
                  disabled={state !== 'idle'}
                  onClick={async e => loadAndStartGame(e.currentTarget.id, submit, setLoading, setTextView)}
                  sx={gamesButtonSxProps}
                >
                  <Label
                    id='chutes-and-ladders-button-label'
                    htmlFor='Chutes-&-Ladders'
                    tooltipTitle={
                      <pre>
                        {
                          'Clicking the button executes the following actions: \n- Starts the Chutes & Ladders instance\n- Registers 2 "Guest" Players\n- Automatically starts the game'
                        }
                      </pre>
                    }
                    labelVariant={'button'}
                    labelText={'Chutes & Ladders'}
                    placement={'top'}
                    // labelWrapperDivSxProps={gamesLabelWrapperSxProps}
                    labelTextSx={gamesButtonLabelsSxProps}
                  />
                </Button>

                <Button
                  LinkComponent={'button'}
                  id='Tic-Tac-Toe'
                  variant='text'
                  disabled={state !== 'idle'}
                  onClick={async e => loadAndStartGame(e.currentTarget.id, submit, setLoading, setTextView)}
                  sx={gamesButtonSxProps}
                >
                  <Label
                    id='tic-tac-toe-button-label'
                    htmlFor='Tic-Tac-Toe"'
                    tooltipTitle={
                      <pre>
                        {
                          'Clicking the button executes the following actions: \n- Starts the Tic Tac Toe instance\n- Registers "X" & "O" Players\n- Automatically starts the game'
                        }
                      </pre>
                    }
                    labelVariant={'button'}
                    labelText={'Tic Tac Toe'}
                    placement={'top'}
                    // labelWrapperDivSxProps={gamesLabelWrapperSxProps}
                    labelTextSx={gamesButtonLabelsSxProps}
                  />
                </Button>
              </ButtonGroup>
            </Toolbar>
          </AppBar>
        </Container>
        <Collapse in={textView}>
          <Container
            component={'div'}
            key={'games-header-text-wrapper'}
            id='games-header-text-wrapper'
            maxWidth={false}
            sx={{ paddingY: 2 }}
          >
            <Text
              component={'p'}
              key={'game-header-text'}
              id='game-header-text'
              titleVariant='body1'
              titleText={body}
            />
          </Container>
        </Collapse>
      </Paper>
      <Box
        component={'div'}
        key={`games-outlet-wrapper`}
        id={`games-outlet-wrapper`}
        sx={{ ...pagesOutletStyles, flexDirection: 'column', height: '100vh' }}
      >
        <Box
          component={'div'}
          key={'games-outlet-loading-wrapper'}
          id={'games-outlet-loading-wrapper'}
          sx={gamesOutletWrapperSxProps(state)}
        >
          {state !== 'idle' && <GameLoading />}
        </Box>
        <Box
          component={'div'}
          key={'games-outlet-game-wrapper'}
          id={'games-outlet-game-wrapper'}
          sx={gamesOutletGameWrapperSxProps}
        >
          {!loading && <Outlet />}
        </Box>
      </Box>
    </Box>
  );
};

export default Games;

const loadAndStartGame = async (
  gameName: string,
  submit: SubmitFunction,
  setLoading: Dispatch<SetStateAction<boolean>>,
  setTextView: Dispatch<SetStateAction<boolean>>,
) => {
  try {
    setTextView(false);
    setLoading(true);
    await submit(gameName, {
      method: 'post',
      encType: 'text/plain',
      relative: 'path',
      replace: true,
    });
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false);
  }
};
