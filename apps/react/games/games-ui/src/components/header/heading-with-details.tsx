import { Text } from '@aklapper/react-shared';
import { Box, ListItem, SxProps } from '@mui/material';
import { TypographyVariant } from '@mui/material/styles';
import { ElementType } from 'react';

export interface HeadingWithDetailsProps {
  component: ElementType;
  id: string | number;
  titleVariant: TypographyVariant;
  titleText: string | undefined;
  titleSx?: SxProps;
  valueVariant: TypographyVariant;
  valueText: string;
  valueSx?: SxProps;
}

export function HeadingWithDetails({
  component,
  id,
  titleVariant,
  titleText,
  titleSx,
  valueVariant,
  valueText,
  valueSx
}: HeadingWithDetailsProps) {
  return (
    <Box component={'div'} key={id}>
      <ListItem component={component}>
        <Text component={'p'} titleVariant={titleVariant} titleText={titleText} sx={titleSx} />
      </ListItem>
      <ListItem component={component}>
        <Text component={'p'} titleVariant={valueVariant} titleText={valueText} sx={valueSx} />
      </ListItem>
    </Box>
  );
}

export default HeadingWithDetails;
