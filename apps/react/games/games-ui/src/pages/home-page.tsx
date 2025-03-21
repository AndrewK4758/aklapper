import { Text } from '@aklapper/react-shared';
import type { SxProps } from '@mui/material/styles';
import JoinGame from '../components/join-game/join-game';
import { errorTextSx, tooltipSx } from '../styles/games-styles';
import { GamesTheme as Theme } from '../styles/games-theme';

import { useContext } from 'react';
import RegisterPlayer from '../components/register-player/register-player';
import { ActivePlayerContext, ActivePlayerContextProps } from '../context/active-user-context';
import type { RegisterPlayerValue } from '../types/types';

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

const registerPlayerPropsObject: RegisterPlayerValue = {
  name: ''
};

const Home = () => {
  const { activePlayer } = useContext<ActivePlayerContextProps>(ActivePlayerContext);

  console.log(activePlayer);
  return (
    <>
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

      {!activePlayer.name && (
        <RegisterPlayer<RegisterPlayerValue>
          method={'POST'}
          inputName={'name'}
          label={'Player Name'}
          inputId={'player-name'}
          formPropsObject={registerPlayerPropsObject}
        />
      )}
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
    </>
  );
};

export default Home;
