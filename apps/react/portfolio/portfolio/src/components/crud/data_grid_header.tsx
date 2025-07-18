import { Text } from '@aklapper/react-shared';
import Container from '@mui/material-pigment-css/Container';
import { css } from '@pigment-css/react';
import Theme from '../../styles/themes/theme';

interface DataGridHeaderProps {
  title: string;
}

export default function DataGridHeader({ title }: DataGridHeaderProps) {
  return (
    <Container id={`${title}-title-box`} className={css({ paddingTop: Theme.spacing(2) })}>
      <Text
        children={title}
        variant={'h5'}
        id={`${title}-title`}
        className={css({
          textAlign: 'center',
        })}
      />
    </Container>
  );
}
