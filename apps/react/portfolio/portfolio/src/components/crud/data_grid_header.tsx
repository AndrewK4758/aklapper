import { Text } from '@aklapper/react-shared';
import Container from '@mui/material-pigment-css/Container';
import CRUD_THEME from '../../styles/themes/crud_theme.js';

interface DataGridHeaderProps {
  title: string;
}

export default function DataGridHeader({ title }: DataGridHeaderProps) {
  return (
    <Container id={`${title}-title-box`} sx={{ paddingTop: CRUD_THEME.spacing(2) }}>
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
