import { Text } from '@aklapper/react-shared';
import Container from '@mui/material-pigment-css/Container';
import Theme from '../../styles/themes/theme';

interface DataGridHeaderProps {
  title: string;
}

export default function DataGridHeader({ title }: DataGridHeaderProps) {
  return (
    <Container id={`${title}-title-box`} sx={{ paddingTop: Theme.spacing(2) }}>
      <Text
        children={title}
        variant={'h5'}
        id={`${title}-title`}
        sx={{
          textAlign: 'center',
        }}
      />
    </Container>
  );
}
