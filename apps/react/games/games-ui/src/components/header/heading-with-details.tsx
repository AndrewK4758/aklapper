import DialogContentText from '@mui/material/DialogContentText';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import type { SxProps } from '@mui/material/styles';

export interface GameRulesListProps {
  id: string | number;
  titleText: string | undefined;
  titleSx?: SxProps;
  valueText: string;
  valueSx?: SxProps;
}

export function GameRulesList({ id, titleText, titleSx, valueText, valueSx }: GameRulesListProps) {
  return (
    <ListItem
      component={'li'}
      id={`${id}-title`}
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
    >
      <ListItemText primary={titleText} sx={titleSx} />
      <ListItemText inset={true} primary={<DialogContentText sx={valueSx}>{valueText}</DialogContentText>} />
    </ListItem>
  );
}

export default GameRulesList;
