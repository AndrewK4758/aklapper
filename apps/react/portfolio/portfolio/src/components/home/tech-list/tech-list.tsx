import { SectionTitle, type SectionTitleProps } from '@aklapper/react-shared';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import type { TypographyVariant } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { css } from '@pigment-css/react';
import { memo } from 'react';
import Theme from '../../../styles/themes/theme';
import TechListItem from './tech_list_item';

interface TechListProps extends SectionTitleProps {
  data: string[];
  id: string;
  labelText: string;
  variant: TypographyVariant;
}

export const TechList = memo(function ({ data, id, labelText, variant }: TechListProps) {
  const mediaQuery = useMediaQuery(Theme.breakpoints.down('lg'));
  return (
    <Grid
      component={'section'}
      id={`${id}-wrapper`}
      data-testid={`tech-list-${id}-list`}
      sx={{ flex: '1 0 20%', maxWidth: mediaQuery ? '206px' : undefined }}
    >
      <SectionTitle
        id={id}
        title={labelText}
        variant={variant}
        overrideThemeStyles={{ borderBottom: `1px solid ${Theme.palette.primary.dark}` }}
      />

      <List id={`${id}-list`} className={css({ display: 'flex', flexDirection: 'column' })}>
        {data.map(entry => (
          <TechListItem key={entry} listItem={entry} />
        ))}
      </List>
    </Grid>
  );
});

export default TechList;
