import { Label, Text, useScrollIntoView } from '@aklapper/react-shared';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Toolbar from '@mui/material/Toolbar';
import { useRef, type Dispatch, type JSX, type SetStateAction } from 'react';
import { Outlet, useNavigation, useOutletContext, useParams, useSubmit, type SubmitFunction } from 'react-router';
import ChutesAndLaddersIcon from '../../components/icons/chutes-and-ladders';
import TicTacToeIcon from '../../components/icons/tic-tac-toe-icon';
import GameLoading from '../../components/loading/loading';
import { gamesButtonLabelsSxProps, gamesButtonSxProps } from '../../styles/games-styles';
import {
  gamesOutletGameWrapperSxProps,
  gamesOutletWrapperSxProps,
  iconStateStyle,
  pagesOutletStyles,
  pagesTitlesBoxStyles,
  pagesTitleSx,
  pagesWrapperStyles
} from '../../styles/pages-styles';
import { body, title } from '../static/games-text';
import { crudPaperSxProps } from '../../styles/crud-styles';
import type { LoadingOutletContext } from '../../types/types';

/**
 * This component renders the main games page, providing an interface for users to select and play different games.
 *
 * @returns {JSX.Element} The rendered Games component.
 */

const Games = (): JSX.Element => {
  const params = useParams();
  const { state } = useNavigation();
  const { loading, setLoading } = useOutletContext<LoadingOutletContext>();
  const divRef = useRef<HTMLElement>(null);
  const submit = useSubmit();

  useScrollIntoView(divRef);

  console.log(`STATE: ${state}`);
  console.log(`LOADING: ${loading}`);
  console.log(`\n`);

  return (
    <Box ref={divRef} component={'div'} key={'games-wrapper'} id="games-wrapper" sx={pagesWrapperStyles}>
      <Paper
        elevation={2}
        component={'div'}
        key={'games-header-wrapper'}
        id="games-header-wrapper"
        sx={crudPaperSxProps}
      >
        <Box component={'section'} key={'games-title-wrapper'} id="games-title-wrapper" sx={pagesTitlesBoxStyles}>
          <Text component={'h2'} titleVariant="h2" titleText={title} sx={pagesTitleSx} />
        </Box>
        <Container
          component={'div'}
          id="games-navbar-container"
          key={'games-navbar-container'}
          maxWidth={false}
          sx={{ paddingBottom: 2 }}
        >
          <AppBar
            component={'div'}
            id="games-navbar-wrapper"
            key={'games-navbar-wrapper'}
            elevation={0}
            position="static"
            sx={{ borderRadius: 1 }}
          >
            <Toolbar component={'nav'} id="games-navbar" key={'games-navbar'}>
              <ButtonGroup id="games-button-group" key={'games-button-group'} fullWidth={true}>
                <Button
                  LinkComponent={'button'}
                  key={'chutes-and-ladders-button'}
                  id="Chutes-&-Ladders"
                  color="inherit"
                  variant="text"
                  disabled={state !== 'idle'}
                  endIcon={<ChutesAndLaddersIcon sx={iconStateStyle(state)} />}
                  onClick={async e => loadAndStartGame(e.currentTarget.id, submit, setLoading)}
                  sx={gamesButtonSxProps}
                >
                  <Label
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
                    labelTextsx={gamesButtonLabelsSxProps}
                  />
                </Button>

                <Button
                  LinkComponent={'button'}
                  key={'tic-tac-toe-button'}
                  id="Tic-Tac-Toe"
                  color="inherit"
                  variant="text"
                  disabled={state !== 'idle'}
                  endIcon={<TicTacToeIcon sx={iconStateStyle(state)} />}
                  onClick={async e => loadAndStartGame(e.currentTarget.id, submit, setLoading)}
                  sx={gamesButtonSxProps}
                >
                  <Label
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
                    labelTextsx={gamesButtonLabelsSxProps}
                  />
                </Button>
              </ButtonGroup>
            </Toolbar>
          </AppBar>
        </Container>
        <Collapse in={params.id === undefined}>
          <Container
            component={'div'}
            key={'games-header-text-wrapper'}
            id="games-header-text-wrapper"
            maxWidth={false}
            sx={{ paddingY: 2 }}
          >
            <Text
              component={'p'}
              key={'game-header-text'}
              id="game-header-text"
              titleVariant="body1"
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
  setLoading: Dispatch<SetStateAction<boolean>>
) => {
  try {
    setLoading(true);
    await submit(gameName, {
      method: 'post',
      encType: 'text/plain',
      relative: 'path',
      replace: true
    });
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false);
  }
};
