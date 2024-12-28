import { Label, Text, useScrollIntoView } from '@aklapper/react-shared';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Toolbar from '@mui/material/Toolbar';
import { useRef, type JSX } from 'react';
import { Outlet, useNavigation, useParams, useSubmit } from 'react-router-dom';
import ChutesAndLaddersIcon from '../../components/icons/chutes-and-ladders';
import TicTacToeIcon from '../../components/icons/tic-tac-toe-icon';
import GameLoading from '../../components/loading/loading';
import { gamesButtonLabelsSxProps } from '../../styles/games-styles';
import {
  iconStateStyle,
  pagesOutletStyles,
  pagesTitlesBoxStyles,
  pagesTitleSx,
  pagesWrapperStyles
} from '../../styles/pages-styles';
import { body, title } from '../static/games-text';

/**
 * This component renders the main games page, providing an interface for users to select and play different games.
 *
 * @returns {JSX.Element} The rendered Games component.
 */

const Games = (): JSX.Element => {
  const params = useParams();
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
        sx={{ width: '70vw' }}
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
                  title="Chutes & Ladders"
                  id="Chutes-&-Ladders"
                  color="inherit"
                  variant="text"
                  disabled={state !== 'idle'}
                  endIcon={<ChutesAndLaddersIcon sx={iconStateStyle(state)} />}
                  onClick={async e => {
                    await submit(e.currentTarget.id, {
                      method: 'post',
                      encType: 'text/plain',
                      relative: 'path',
                      replace: true
                    });
                  }}
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
                    sx={gamesButtonLabelsSxProps}
                  />
                </Button>

                <Button
                  LinkComponent={'button'}
                  key={'tic-tac-toe-button'}
                  title="Tic Tac Toe"
                  id="Tic-Tac-Toe"
                  color="inherit"
                  variant="text"
                  disabled={state !== 'idle'}
                  endIcon={<TicTacToeIcon sx={iconStateStyle(state)} />}
                  onClick={async e => {
                    await submit(e.currentTarget.id, {
                      method: 'post',
                      encType: 'text/plain',
                      relative: 'path',
                      replace: true
                    });
                  }}
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
                    sx={gamesButtonLabelsSxProps}
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
      <Box component={'div'} key={`games-outlet-wrapper`} id={`games-outlet-wrapper`} sx={pagesOutletStyles}>
        {state !== 'idle' ? <GameLoading /> : <Outlet />}
      </Box>
    </Box>
  );
};

export default Games;
