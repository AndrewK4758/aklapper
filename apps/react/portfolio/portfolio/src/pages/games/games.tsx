import { CenteredFlexDiv } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import type { ReactElement } from 'react';
import { Outlet, useNavigation, useParams } from 'react-router';
import GamesHeader from '../../components/games/header';

/**
 * This component renders the main games page, providing an interface for users to select and play different games.
 *
 * @returns {ReactElement} The rendered Games component.
 */

const Games = (): ReactElement => {
  const params = useParams();
  const { state } = useNavigation();

  const outletKey = params.id ?? 'game';

  return (
    <CenteredFlexDiv id='games-wrapper'>
      <Box sx={{ display: 'flex', width: '100%' }}>
        <GamesHeader state={state} />
      </Box>

      <Box component={'div'} id={`games-outlet-wrapper`} sx={{ width: '100%' }}>
        <Outlet key={outletKey} />
      </Box>
    </CenteredFlexDiv>
  );
};

export default Games;
