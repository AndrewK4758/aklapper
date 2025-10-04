import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useContext, type ReactElement, type ReactNode } from 'react';
import { GoogleUserContext, type GoogleUserContextProps } from '../../contexts/contact_context_constants';
import Theme from '../../styles/themes/theme';

interface CalendarLayoutProps {
  children: ReactNode | ReactNode[];
  Header: ReactNode;
}

export default function CalendarLayout({ Header, children }: CalendarLayoutProps): ReactElement<CalendarLayoutProps> {
  const { GoogleUserContextValues } = useContext<GoogleUserContextProps>(GoogleUserContext);
  console.log(GoogleUserContextValues);
  return (
    <Box
      sx={{
        border: `2px solid --mui-palette-info-main`,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        component={'header'}
        sx={{
          border: `2px solid ${Theme.palette.secondary.main}`,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <AppBar position='static' color='default'>
          <Toolbar>
            <Box sx={{ flex: 9 }}>
              <Typography variant='h3' sx={{ border: '2px solid', color: '--mui-palette-info-light' }}>
                {`${Header}`}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 'fit-content', display: 'flex', justifyContent: 'flex-end' }}>
              <Avatar alt='Avatar' srcSet={GoogleUserContextValues.picture} sx={{ border: '2px solid' }} />
            </Box>
          </Toolbar>
        </AppBar>
      </Box>
      {children}
    </Box>
  );
}
