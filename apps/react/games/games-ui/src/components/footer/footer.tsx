import { Text } from '@aklapper/react-shared';
import AppBar from '@mui/material/AppBar';
import type { SxProps } from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import type { ElementType } from 'react';

export interface FooterProps {
  component: ElementType;
  breakpointsFooter?: SxProps;
  breakpointsFooterText?: SxProps;
}

export default function Footer({ component, breakpointsFooter, breakpointsFooterText }: FooterProps) {
  return (
    <AppBar position='static' component={component} sx={breakpointsFooter}>
      <Toolbar component={'span'} variant='dense'>
        <Text
          titleVariant='h4'
          component={'h4'}
          titleText={`\u00A9 A.Klapper ${new Date().getFullYear()}`}
          sx={{
            ...breakpointsFooterText,
            textAlign: 'center',
            justifyContent: 'center',
          }}
          TypogrpahyProps={{
            color: 'textPrimary',
          }}
        />
      </Toolbar>
    </AppBar>
  );
}
