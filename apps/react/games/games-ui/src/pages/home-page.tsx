import { Text } from '@aklapper/react-shared';
import type { IPlayer } from '@aklapper/types';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import type { SxProps } from '@mui/material/styles';
import { useContext, type Dispatch, type SetStateAction } from 'react';
import RegisterPlayer from '../components/register-player/register-player';
import ActivePlayerContext, { ActivePlayerContextProps } from '../context/active-player-context';
import { GamesTheme as Theme } from '../styles/games-theme';

const homePageTitleText: SxProps = {
  [Theme.breakpoints.down('md')]: {
    fontSize: '4rem',
  },
};

const joinGameTextInputSxProps: SxProps = {
  width: '50vw',
};

const registerPlayerPropsObject = {
  name: '',
} as IPlayer;

const Home = () => {
  const { activePlayer, setActivePlayer } = useContext<ActivePlayerContextProps>(ActivePlayerContext);

  return (
    <Box
      component={'div'}
      id='home-page-wrapper'
      sx={{ display: 'flex', flexDirection: 'column', gap: 10, paddingY: 2 }}
    >
      <Text component={'h1'} titleVariant='h1' titleText='Welcome To My Game' sx={homePageTitleText} />
      <Box component={'section'} id='home-page-instructions-register-wrapper' sx={{ display: 'flex' }}>
        <Card component={'section'} id='home-page-instructions-wrapper'>
          <CardHeader
            component='section'
            title={<Text titleVariant='h2' component={'h2'} titleText='Instructions' />}
          />
          <Divider variant='middle' />
          <List component={'ul'} id='intructions-list' sx={{ paddingY: 4 }}>
            <ListItem component={'li'} id='instruction-1'>
              Submit your player name to enter the Game Lobby
            </ListItem>
            <ListItem component={'li'} id='instruction-2'>
              You can join a game looking for players or create a game for others to join
            </ListItem>
            <ListItem component={'li'} id='instruction-3'>
              The Game Lobby has private messaging to communicate with other active players
            </ListItem>
            <ListItem component={'li'} id='instruction-4'>
              Player is data is erased once when you leave the lobby using the button
            </ListItem>
          </List>
        </Card>
        <Container component={'section'} id='home-page-register-player-wrapper'>
          <Text titleVariant='h2' component={'h2'} titleText={'Register'} />
          {!activePlayer.Name && (
            <RegisterPlayer<IPlayer>
              method={'POST'}
              inputName={'name'}
              label={'Player Name'}
              inputId={'player-name'}
              formPropsObject={registerPlayerPropsObject}
              inputSx={joinGameTextInputSxProps}
            />
          )}

          {activePlayer.Name && (
            <Button id='logout-player' variant='outlined' onClick={() => handleLogoutPlayer(setActivePlayer)}>
              Logout
            </Button>
          )}
        </Container>
      </Box>
    </Box>
  );
};

export default Home;

function handleLogoutPlayer(setActivePlayer: Dispatch<SetStateAction<Partial<IPlayer>>>) {
  const currentPlayer = sessionStorage.getItem('activePlayer');

  if (currentPlayer) {
    sessionStorage.removeItem('activePlayer');
  }

  setActivePlayer({ Id: '', Name: '', InLobby: false, ActiveGameID: null });
}
