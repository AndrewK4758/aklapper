import { SectionTitle } from '@aklapper/react-shared';
import Box from '@mui/material-pigment-css/Box';
import CardHeader from '@mui/material/CardHeader';
import useMediaQuery from '@mui/material/useMediaQuery';
import { css } from '@pigment-css/react';
import { memo, type ReactElement } from 'react';
import '../../styles/colors-and-fonts.css';
import Theme from '../../styles/themes/theme';
import { ABOUT_ME_TITLE } from '../home/static/intro-static';

interface PicNameAndNavProps {
  subheader: ReactElement;
}

export default memo(function PicNameAndNav({ subheader }: PicNameAndNavProps) {
  const mediaQuery = useMediaQuery(Theme.breakpoints.down('md'));
  return (
    <>
      <CardHeader
        title={
          <SectionTitle
            title={ABOUT_ME_TITLE}
            variant={mediaQuery ? 'h4' : 'h1'}
            overrideThemeStyles={{ fontFamily: 'League Gothic' }}
          />
        }
        subheader={!mediaQuery && subheader}
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
        <Box className={css({ padding: `0 ${Theme.spacing(4)} ${Theme.spacing(4)} ${Theme.spacing(4)}` })}>
          {subheader}
        </Box>
      )}
    </>
  );
});
