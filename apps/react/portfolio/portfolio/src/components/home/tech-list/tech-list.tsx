import { SectionTitle, type SectionTitleProps } from '@aklapper/react-shared';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import type { TypographyVariant } from '@mui/material/styles';
import Theme from '../../../styles/themes/theme';
import TechListItem from './tech_list_item';

interface TechListProps extends SectionTitleProps {
  data: string[];
  id: string;
  labelText: string;
  variant: TypographyVariant;
}

export const TechList = ({ data, id, labelText, variant, placement }: TechListProps) => (
  <Grid id={`${id}-wrapper`} data-testid={`tech-list-${id}-title-text`}>
    <SectionTitle
      id={id}
      title={labelText}
      placement={placement}
      variant={variant}
      style={{ borderBottom: `1px solid ${Theme.palette.primary.dark}` }}
    />

    <List id={`${id}-list`} sx={{ display: 'flex', flexDirection: 'column' }}>
      {data.map(entry => (
        <TechListItem key={entry} listItem={entry} />
      ))}
    </List>
  </Grid>
);

export default TechList;
