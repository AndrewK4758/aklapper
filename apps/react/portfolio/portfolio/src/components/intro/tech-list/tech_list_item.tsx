import ListItem, { type ListItemProps } from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import type { SxProps } from '@mui/material/styles';
import type { CSSProperties } from 'react';
import Theme from '../../../styles/themes/theme.js';

const techListItemSxProps: SxProps = { display: 'flex', flexDirection: 'row', justifyItems: 'space-between' };
const svgCssStyle: CSSProperties = { width: '2rem', height: 'auto', margin: 'auto' };

interface TechListItemProps extends ListItemProps {
  listItem: string;
}

export default function TechListItem({ listItem, ...props }: TechListItemProps) {
  return (
    <ListItem {...props} id={`${listItem}-wrapper`} data-testid={`${listItem}-wrapper`} sx={techListItemSxProps}>
      <ListItemText
        id={listItem}
        data-testid={listItem}
        primary={listItem}
        sx={{ color: Theme.palette.text.secondary }}
      />
      <ListItemIcon id={`${listItem}-icon-wrapper`} data-testid={`${listItem}-icon-wrapper`}>
        <img
          data-testid={`${listItem}-svg-icon`}
          id={`${listItem}-svg-icon`}
          src={`/client/icons/${listItem.toLowerCase()}-icon.svg`}
          alt={`${listItem}-icon`}
          role='img'
          style={svgCssStyle}
        />
      </ListItemIcon>
    </ListItem>
  );
}
