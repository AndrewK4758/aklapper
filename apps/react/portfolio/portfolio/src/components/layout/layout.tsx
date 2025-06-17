// import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardHeader, { type CardHeaderSlotsAndSlotProps } from '@mui/material/CardHeader';
import CardMedia from '@mui/material/CardMedia';
import { type ReactElement } from 'react';
import { Outlet } from 'react-router';
import Theme from '../../styles/theme';
import Footer from '../footer/footer';
import HeaderContactMenu from '../header/header.js';
import { ABOUT_ME_TITLE } from '../intro/static/intro-text';

import { SectionTitle } from '@aklapper/react-shared';
import AnimatedBorderBox from '../styled/animated_border_box';
import CenteredFlexDiv from '../styled/centered_flexbox';
import StyledCard from '../styled/styled_card';
import StyledRootComponentWrapper from '../styled/styled_root_wrapper';

/**
 * This component renders the main layout of the application.
 * It includes the header, home section, navigation menus, main content area, and footer.
 *
 * @returns {ReactElement} The rendered Layout component.
 */

const slotProps: CardHeaderSlotsAndSlotProps = {
  slotProps: {
    avatar: {
      sx: {
        flex: '0 1 15%',
      },
    },
  },
};

const myName = <SectionTitle title={ABOUT_ME_TITLE} variant='h1' />;

export default function Layout(): ReactElement {
  return (
    <StyledRootComponentWrapper id='app-wrapper' sx={{ borderRadius: 0, minHeight: '100vh', height: 'fit-content' }}>
      <HeaderContactMenu />

      <CenteredFlexDiv component={'main'} sx={{ padding: Theme.spacing(0, 4), flex: 1 }}>
        <StyledCard raised elevation={4} sx={{ width: '100%', flex: 1 }}>
          <CardHeader
            title={myName}
            subheader={<AnimatedBorderBox />}
            avatar={
              <img
                rel='preload'
                crossOrigin=''
                id={'card-media-resume-image'}
                data-testid={'card-media-resume-image'}
                src={'/client/images/self.webp'}
                loading='eager'
                alt='andrew'
                style={{
                  width: '100%',
                  borderRadius: Theme.shape.borderRadius,
                }}
              />
            }
            {...slotProps}
          />
          <Outlet />
        </StyledCard>
      </CenteredFlexDiv>

      <Footer />
    </StyledRootComponentWrapper>
  );
}
