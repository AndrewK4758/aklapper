import ListItem, { type ListItemProps } from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { css } from '@pigment-css/react';
import Theme from '../../../styles/themes/theme';

interface TechListItemProps extends ListItemProps {
  listItem: string;
}

export default function TechListItem({ listItem, ...props }: TechListItemProps) {
  return (
    <ListItem
      {...props}
      id={`${listItem}-wrapper`}
      data-testid={`${listItem}-wrapper`}
      className={css({ display: 'flex', justifyItems: 'space-between' })}
    >
      <ListItemText
        id={listItem}
        data-testid={listItem}
        primary={listItem}
        className={css({ color: Theme.palette.text.secondary })}
      />
      <ListItemIcon id={`${listItem}-icon-wrapper`} data-testid={`${listItem}-icon-wrapper`}>
        <img
          data-testid={`${listItem}-svg-icon`}
          id={`${listItem}-svg-icon`}
          src={`/icons/intro/${listItem.toLowerCase()}-icon.svg`}
          alt={`${listItem}-icon`}
          role='img'
          loading='lazy'
          className={css({ width: '32px', height: '32px', margin: 'auto' })}
        />
      </ListItemIcon>
    </ListItem>
  );
}
