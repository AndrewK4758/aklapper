import { CenteredFlexDiv } from '@aklapper/react-shared';
import Box from '@mui/material-pigment-css/Box';
import { ReactElement, useState } from 'react';
import { Outlet, useNavigation } from 'react-router';
import GamesHeader from '../../components/games/header';
import GameLoading from '../../components/loading/loading';

/**
 * This component renders the main games page, providing an interface for users to select and play different games.
 *
 * @returns {ReactElement} The rendered Games component.
 */

const Games = (): ReactElement => {
  const { state } = useNavigation();
  const [loading, setLoading] = useState(false);

  return (
    <CenteredFlexDiv id='games-wrapper' sx={{}}>
      <Box sx={{ display: 'flex', width: '100%' }}>
        <GamesHeader state={state} setLoading={setLoading} />
      </Box>

      <Box as={'div'} id={`games-outlet-wrapper`} sx={{ width: '100%' }}>
        {state !== 'idle' && <GameLoading />}
        {!loading && <Outlet />}
      </Box>
    </CenteredFlexDiv>
  );
};

export default Games;
