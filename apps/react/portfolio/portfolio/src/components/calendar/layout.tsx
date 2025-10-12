import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Grid from '@mui/material/Grid';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useContext, type ReactElement, type ReactNode } from 'react';
import { GoogleUserContext, type GoogleUserContextProps } from '../../contexts/contact_context_constants';

interface CalendarLayoutProps {
  children: ReactNode | ReactNode[];
  Header: ReactNode;
}

export default function CalendarLayout({ Header, children }: CalendarLayoutProps): ReactElement<CalendarLayoutProps> {
  const { GoogleUserContextValues } = useContext<GoogleUserContextProps>(GoogleUserContext);
  console.log(GoogleUserContextValues);
  return (
    <Grid container width={'100%'}>
      <Grid size={12}>
        <AppBar position='static' color='default' square={false}>
          <Toolbar>
            <Grid container={true} width={'100%'} alignItems={'center'}>
              <Grid size={11}>
                <Typography variant='h3' sx={{ color: 'InfoText' }}>
                  {`${Header}`}
                </Typography>
              </Grid>
              <Grid size={1} justifyItems={'flex-end'}>
                <Avatar alt='Avatar' srcSet={GoogleUserContextValues.picture} />
              </Grid>
            </Grid>
          </Toolbar>
        </AppBar>
      </Grid>

      {children}
    </Grid>
  );
}
