import { Text, useScrollIntoView } from '@aklapper/react-shared';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Toolbar from '@mui/material/Toolbar';
import { useRef, useState, type Dispatch, type JSX, type SetStateAction } from 'react';
import { Outlet, useNavigation, useSubmit, type SubmitFunction } from 'react-router-dom';
import ChutesAndLaddersIcon from '../../components/icons/chutes-and-ladders';
import TicTacToeIcon from '../../components/icons/tic-tac-toe-icon';
import {
  pagesButtonStyles,
  pagesOutletStyles,
  pagesTitlesBoxStyles,
  pagesTitleSx,
  pagesToolbarStyles,
  pagesWrapperStyles
} from '../../styles/pages-styles';
import { body, title } from '../static/games-text';
import GameLoading from '../../components/loading/loading';

/**
 * This component renders the main games page, providing an interface for users to select and play different games.
 *
 * @returns {JSX.Element} The rendered Games component.
 */

const Games = (): JSX.Element => {
  const [loading, setLoading] = useState<boolean | null>(false);
  const { state } = useNavigation();
  const divRef = useRef<HTMLElement>(null);
  const submit = useSubmit();

  useScrollIntoView(divRef);

  return (
    <Box ref={divRef} component={'div'} key={'games-wrapper'} id="games-wrapper" sx={pagesWrapperStyles}>
      <Paper
        elevation={2}
        component={'div'}
        key={'games-header-wrapper'}
        id="games-header-wrapper"
        sx={{ width: '60vw' }}
      >
        <Box component={'section'} key={'games-title-wrapper'} id="games-title-wrapper" sx={pagesTitlesBoxStyles}>
          <Text component={'h2'} titleVariant="h2" titleText={title} sx={pagesTitleSx} />
        </Box>
        <AppBar
          component={'div'}
          id="games-navbar-wrapper"
          key={'games-navbar-wrapper'}
          elevation={0}
          position="static"
          sx={{ width: '95%', justifySelf: 'center' }}
        >
          <Toolbar component={'nav'} id="games-navbar" key={'games-navbar'} sx={pagesToolbarStyles}>
            <Button
              LinkComponent={'button'}
              key={'chutes-and-ladders-button'}
              title="Chutes & Ladders"
              id="Chutes-&-Ladders"
              disabled={state !== 'idle'}
              endIcon={
                <ChutesAndLaddersIcon
                  sx={{
                    opacity: state !== 'idle' ? 0.38 : 1,
                    scale: 1.75
                  }}
                />
              }
              onClick={e => handleSelectGame(e.currentTarget.id, submit, setLoading)}
              sx={pagesButtonStyles}
            >
              Chutes & Ladders
            </Button>

            <Button
              LinkComponent={'button'}
              key={'tic-tac-toe-button'}
              type="submit"
              title="Tic Tac Toe"
              id="Tic-Tac-Toe"
              disabled={state !== 'idle'}
              endIcon={
                <TicTacToeIcon
                  sx={{
                    opacity: state !== 'idle' ? 0.38 : 1,
                    scale: 1.5
                  }}
                />
              }
              onClick={e => handleSelectGame(e.currentTarget.id, submit, setLoading)}
              sx={pagesButtonStyles}
            >
              Tic Tac Toe
            </Button>
          </Toolbar>
        </AppBar>
        <Container
          component={'div'}
          key={'games-header-text-wrapper'}
          id="games-header-text-wrapper"
          sx={{ paddingY: 2 }}
        >
          <Text component={'p'} key={'game-header-text'} id="game-header-text" titleVariant="body1" titleText={body} />
        </Container>
      </Paper>
      <Box component={'div'} key={`games-outlet-wrapper`} id={`games-outlet-wrapper`} sx={pagesOutletStyles}>
        {loading === true && <GameLoading />}
        {loading === false && <Outlet />}
      </Box>
    </Box>
  );
};

export default Games;

/**
 * This function handles the selection of a game.
 * It submits the game name to the server and updates the loading state.
 *
 * @param {string} gameName - The name of the game to select.
 * @param {SubmitFunction} submit - A function for submitting the game name to the server.
 * @param {Dispatch<SetStateAction<boolean | null>>} setLoading - A function to update the loading state.
 */

const handleSelectGame = async (
  gameName: string,
  submit: SubmitFunction,
  setLoading: Dispatch<SetStateAction<boolean | null>>
) => {
  try {
    setLoading(true);
    await submit(gameName, { method: 'post', relative: 'path', encType: 'text/plain' });
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false);
  }
};
