import { CenteredFlexDiv } from '@aklapper/react-shared';
import { css } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';
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
      <Box className={css({ display: 'flex', width: '100%' })}>
        <GamesHeader state={state} />
      </Box>

      <Box as={'div'} id={`games-outlet-wrapper`} className={css({ width: '100%' })}>
        <Outlet key={outletKey} />
      </Box>
    </CenteredFlexDiv>
  );
};

export default Games;
