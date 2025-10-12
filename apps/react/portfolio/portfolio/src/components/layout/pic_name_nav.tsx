import { SectionTitle } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import CardHeader from '@mui/material/CardHeader';
import useMediaQuery from '@mui/material/useMediaQuery';
import { memo } from 'react';
import Theme from '../../styles/themes/theme';
import { ABOUT_ME_TITLE } from '../home/static/intro-static';
import AppNavBar from './navigation/app_nav_bar';

export default memo(function PicNameAndNav() {
  const mediaQuery = useMediaQuery(Theme.breakpoints.down('md'));
  return (
    <>
      <CardHeader
        title={<SectionTitle title={ABOUT_ME_TITLE} variant={mediaQuery ? 'h4' : 'h1'} />}
        subheader={!mediaQuery && <AppNavBar />}
        avatar={
          <img
            crossOrigin='anonymous'
            id={'card-media-resume-image'}
            data-testid={'card-media-resume-image'}
            src={'/images/self.webp'}
            loading='eager'
            alt='Andrew'
            style={{
              width: '452px',
              maxWidth: '100%',
              height: 'auto',
              borderRadius: Theme.shape.borderRadius,
            }}
          />
        }
        slotProps={{
          avatar: {
            sx: {
              marginRight: mediaQuery ? 0 : '16px',
            },
          },
        }}
        sx={{ flexDirection: mediaQuery ? 'column' : 'row', alignItems: 'center', justifyItems: 'center' }}
      />
      {mediaQuery && (
        <Box sx={{ padding: `0 ${Theme.spacing(4)} ${Theme.spacing(4)} ${Theme.spacing(4)}` }}>
          <AppNavBar />
        </Box>
      )}
    </>
  );
});
