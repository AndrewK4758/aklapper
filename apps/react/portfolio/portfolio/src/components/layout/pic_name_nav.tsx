import { SectionTitle } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import CardHeader from '@mui/material/CardHeader';
import useMediaQuery from '@mui/material/useMediaQuery';
import { memo } from 'react';
import Theme from '@styles/themes/theme';
import { ABOUT_ME_TITLE } from '@components/home/static/intro-static';
import AppNavBar from './navigation/app_nav_bar';
import styles from '@styles/layout/layout.module.css';

export default memo(function PicNameAndNav() {
  const mediaQuery = useMediaQuery(Theme.breakpoints.down('md'));
  return (
    <>
      <CardHeader
        className={styles.cardHeader}
        title={<SectionTitle title={ABOUT_ME_TITLE} variant={mediaQuery ? 'h4' : 'h1'} />}
        subheader={!mediaQuery && <AppNavBar />}
        avatar={
          <img
            crossOrigin='anonymous'
            className={styles.selfImg}
            id={'card-media-resume-image'}
            data-testid={'card-media-resume-image'}
            src={'/images/self.webp'}
            loading='eager'
            alt='Andrew'
          />
        }
        slotProps={{
          avatar: {
            className: styles.avatarMargin,
          },
        }}
      />
      {mediaQuery && (
        <Box className={styles.navBarWrapper}>
          <AppNavBar />
        </Box>
      )}
    </>
  );
});
