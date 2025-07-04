import { Text } from '@aklapper/react-shared';
import type { IRegisterLoaderAndFilter } from '@aklapper/types';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import type { SxProps } from '@mui/material/styles';
import { useLocation, useRouteLoaderData } from 'react-router';
import RegisterPlayerAndAvatarForm from '../components/formik_form_components/register_player_and_avatar_formik';
import { GamesTheme as Theme } from '../styles/games-theme';

const breakpointsRegisterPlayerTitle: SxProps = {
  [Theme.breakpoints.down('md')]: {
    fontSize: '2rem',
  },
};

const breakpointsRegisterPlayerTitleBox: SxProps = { flex: '1 0 33.3%' };

const breakpointsRegisterPlayerTitleValue: SxProps = {
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem',
  },
};

const breakpointsCopyIcon: SxProps = {
  fontSize: '2.5rem',
  color: Theme.palette.primary.contrastText,
  [Theme.breakpoints.down('md')]: {
    fontSize: '1.25rem',
  },
};

const handleCopyGameLinkToClipboard = (gameLocatordata: string): Promise<void> =>
  navigator.clipboard.writeText(gameLocatordata);

export default function RegisterPlayerAndAvatarOnGame() {
  const loader = useRouteLoaderData('registerData') as IRegisterLoaderAndFilter;
  const location = useLocation();

  const gameID = loader.gamePlayerIDs.gameInstanceID ?? '';
  const playerID = loader.gamePlayerIDs.playerID ?? '';

  const gameLocatordata = location.pathname.replace('register', `${gameID}`).slice(1);

  return (
    <>
      <Container component={'section'} sx={{ borderBottom: `5px solid ${Theme.palette.background.paper}` }}>
        <Box sx={breakpointsRegisterPlayerTitleBox}>
          <Text variant='h2' children={'Game ID:'} sx={breakpointsRegisterPlayerTitle} />
          <Text variant='body1' children={gameID} sx={breakpointsRegisterPlayerTitleValue} />
        </Box>
        <Box sx={breakpointsRegisterPlayerTitleBox}>
          <Text variant='h2' children={'Player ID: '} sx={breakpointsRegisterPlayerTitle} />
          <Text
            variant='body1'
            children={`${playerID ? playerID : 'Please Register'}`}
            sx={breakpointsRegisterPlayerTitleValue}
          />
        </Box>
        <Box sx={breakpointsRegisterPlayerTitleBox}>
          <Text variant='h2' children={'Game Link:'} sx={breakpointsRegisterPlayerTitle} />
          <Text variant='body1' children={gameLocatordata} sx={breakpointsRegisterPlayerTitleValue} />
          <IconButton
            onClick={() => handleCopyGameLinkToClipboard(gameLocatordata)}
            sx={{
              '&:hover': { backgroundColor: Theme.palette.primary.main },
            }}
          >
            <ContentCopyIcon titleAccess='Copy Game Link' sx={breakpointsCopyIcon} />
          </IconButton>
        </Box>
      </Container>
      <RegisterPlayerAndAvatarForm />
    </>
  );
}
