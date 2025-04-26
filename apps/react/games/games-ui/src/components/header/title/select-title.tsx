import { Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import { titleText } from '../../../styles/header-styles';

interface SelectTitleProps {
  pathname: string;
}

export default function SelectTitle({ pathname }: SelectTitleProps) {
  switch (pathname) {
    case '/':
      return Title('Welcome To My Game');

    case '/lobby':
      return Title('Lobby');

    default:
      return null;
  }
}

const Title = (title: string) => (
  <Box component={'section'} id='home-title-section' flex={1}>
    <Text component={'h1'} titleVariant='h1' titleText={title} sx={titleText} />
  </Box>
);
