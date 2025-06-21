import { Text } from '@aklapper/react-shared';
import Container from '@mui/material/Container';
import CRUD_THEME from '../../styles/themes/crud_theme.js';

interface DataGridHeaderProps {
  title: string;
}

export default function DataGridHeader({ title }: DataGridHeaderProps) {
  return (
    <Container id={`${title}-title-box`} sx={{ paddingY: CRUD_THEME.spacing(2) }}>
      <Text
        color='textPrimary'
        children={title}
        variant={'h3'}
        id={`${title}-title`}
        sx={{
          textAlign: 'center',
        }}
      />
    </Container>
  );
}
