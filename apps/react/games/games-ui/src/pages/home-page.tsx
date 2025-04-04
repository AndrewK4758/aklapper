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
    fontSize: '4rem'
  }
};

const joinGameTextInputSxProps: SxProps = {
  width: '50vw'
};

const registerPlayerPropsObject = {
  name: ''
} as IPlayer;

const Home = () => {
  const { activePlayer, setActivePlayer } = useContext<ActivePlayerContextProps>(ActivePlayerContext);

  return (
    <Box
      component={'div'}
      id="home-page-wrapper"
      sx={{ display: 'flex', flexDirection: 'column', gap: 10, paddingY: 2 }}
    >
      <Text component={'h1'} titleVariant="h1" titleText="Welcome To My Game" sx={homePageTitleText} />
      <Box component={'section'} id="home-page-instructions-register-wrapper" sx={{ display: 'flex' }}>
        <Card component={'section'} id="home-page-instructions-wrapper">
          <CardHeader
            component="section"
            title={<Text titleVariant="h2" component={'h2'} titleText="Instructions" />}
          />
          <Divider variant="middle" />
          <List component={'ul'} id="intructions-list" sx={{ paddingY: 4 }}>
            <ListItem component={'li'} id="instruction 1">
              Enter player name to enjoy the best experience.
            </ListItem>
            <ListItem component={'li'} id="instruction 2">
              Click on MENU &#8658; SHOW GAMES to select your title
            </ListItem>
            <ListItem component={'li'} id="instruction 3">
              Enter your link into the Container below to join active game
            </ListItem>
          </List>
        </Card>
        <Container component={'section'} id="home-page-register-player-wrapper">
          <Text titleVariant="h2" component={'h2'} titleText={'Register'} />
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
            <Button id="logout-player" variant="outlined" onClick={() => handleLogoutPlayer(setActivePlayer)}>
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
