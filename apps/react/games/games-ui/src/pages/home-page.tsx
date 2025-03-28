import { Label, Text } from '@aklapper/react-shared';
import type { IPlayer } from '@aklapper/types';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import type { SxProps } from '@mui/material/styles';
import { useContext, type Dispatch, type SetStateAction } from 'react';
import JoinGame from '../components/join-game/join-game';
import RegisterPlayer from '../components/register-player/register-player';
import { ActivePlayerContext, ActivePlayerContextProps } from '../context/active-player-context';
import { errorTextSx, tooltipSx } from '../styles/games-styles';
import { GamesTheme as Theme } from '../styles/games-theme';

const homePageTitleText: SxProps = {
  [Theme.breakpoints.down('md')]: {
    fontSize: '4rem'
  }
};

const homePageInfoText: SxProps = {
  paddingY: 2,
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem'
  }
};

const homePageJoinGameButton: SxProps = {
  [Theme.breakpoints.down('md')]: {
    fontSize: '1.5rem'
  }
};

const homePageJoinGameLabel: SxProps = {
  fontSize: '2rem'
};

const homePageJoinGameTextfield: SxProps = {
  width: '30vw'
};

const textfieldLabelWrapper: SxProps = {};

const registerPlayerPropsObject: Partial<IPlayer> = {
  name: ''
};

const Home = () => {
  const { activePlayer, setActivePlayer } = useContext<ActivePlayerContextProps>(ActivePlayerContext);

  // useEffect(() => {
  //   const savedPlayer = sessionStorage.getItem('activePlayer');
  //   if (savedPlayer) {
  //     const playerInfo: Partial<IPlayer> = JSON.parse(savedPlayer);
  //     setActivePlayer({ name: playerInfo.name, id: playerInfo.id });
  //   }
  // }, []);

  return (
    <Box component={'div'} id="home-page-wrapper" sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Text component={'h1'} titleVariant="h1" titleText="Welcome To My Game" sx={homePageTitleText} />
      <Text
        component={'p'}
        titleVariant="body1"
        titleText={
          <>
            Login or Register to enjoy the best experience. <br /> THEN <br /> Click on MENU &#8658; SHOW GAMES to
            select your title <br /> OR <br /> Enter your link into the box below to join active game
          </>
        }
        sx={homePageInfoText}
      />

      {!activePlayer.Name && (
        <RegisterPlayer<Partial<IPlayer>>
          method={'POST'}
          inputName={'name'}
          label={'Player Name'}
          inputId={'player-name'}
          formPropsObject={registerPlayerPropsObject}
        />
      )}
      {!activePlayer.Name && (
        <JoinGame
          method="patch"
          type="text"
          buttonText="Join Game"
          buttonType="submit"
          variant="outlined"
          homePageJoinGameButton={homePageJoinGameButton}
          homePageJoinGameLabel={homePageJoinGameLabel}
          homePageJoinGameTextfield={homePageJoinGameTextfield}
          textfieldLabelWrapper={textfieldLabelWrapper}
          tooltipSx={tooltipSx}
          errorTextSx={errorTextSx}
          names={['gamePath']}
        />
      )}
      {activePlayer.Name && (
        <Button id="logout-player" variant="outlined" onClick={() => handleLogoutPlayer(setActivePlayer)}>
          <Label
            id="logout-player-label"
            htmlFor="logout-player"
            tooltipTitle={'Press to log out player'}
            labelText="Logout"
            labelVariant={'button'}
            placement={'top'}
            labelTextSx={{ fontSize: '2rem' }}
          />
        </Button>
      )}
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
