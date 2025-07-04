import { Text } from '@aklapper/react-shared';
import Container from '@mui/material/Container';
import { useNavigate } from 'react-router';

interface INoGameError {
  noGameInstance: string;
}

interface INotEnoughPlayers {
  notEnoughPlayers: string;
}
export const NoGameError = () => {
  const nav = useNavigate();
  const error: INoGameError = {
    noGameInstance: 'GAME IS NOT FOUND. PLEASE GO BACK AND REGISTER A NEW GAME TO CONTINUE',
  };

  setTimeout(() => {
    return nav('/');
  }, 4000);
  return (
    <Container component={'div'}>
      <Text variant='h1' children={error.noGameInstance} />
    </Container>
  );
};

export const NotEnoughPlayersError = () => {
  const error: INotEnoughPlayers = {
    notEnoughPlayers: 'Must be minumum of 2 players',
  };

  return (
    <Container component={'div'}>
      <Text variant='h1' children={error.notEnoughPlayers} />
    </Container>
  );
};
