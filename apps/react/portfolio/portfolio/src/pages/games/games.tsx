import { Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import { ReactElement, useState } from 'react';
import { Outlet, useNavigation } from 'react-router';
import GamesHeader from '../../components/games/header';
import GameLoading from '../../components/loading/loading';
import CenteredFlexDiv from '../../components/styled/centered_flexbox';
import { gamesOutletGameWrapperSxProps, gamesOutletWrapperSxProps, pagesOutletStyles } from '../../styles/pages-styles';
import { body } from '../static/games-text';

/**
 * This component renders the main games page, providing an interface for users to select and play different games.
 *
 * @returns {ReactElement} The rendered Games component.
 */

const Games = (): ReactElement => {
  const { state } = useNavigation();
  const [loading, setLoading] = useState(false);
  const [textView, setTextView] = useState(true);

  return (
    <CenteredFlexDiv id='games-wrapper'>
      <GamesHeader state={state} setLoading={setLoading} setTextView={setTextView} />
      <Collapse in={textView}>
        <Container id='games-header-text-wrapper'>
          {/*Edit the text*/}
          <Text id='game-header-text' variant='body1' children={body} />
        </Container>
      </Collapse>

      <Box component={'div'} id={`games-outlet-wrapper`}>
        {state !== 'idle' && <GameLoading />}

        {/* <Box component={'div'} id={'games-outlet-game-wrapper'} sx={gamesOutletGameWrapperSxProps}> */}
        {!loading && <Outlet />}
        {/* </Box> */}
      </Box>
    </CenteredFlexDiv>
  );
};

export default Games;
