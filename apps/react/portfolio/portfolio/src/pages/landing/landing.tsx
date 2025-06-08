import Box, { type BoxProps } from '@mui/material/Box';
import { useRef, useState } from 'react';
import LandingHeader from '../../components/landing/landing_header';
import LandingSvgAnimation from '../../components/landing/landing_svg_animation';
import LayoutRootWrapper from '../../components/styled/layout_root_wrapper';

const ANIMATION_FADE_OUT_TIME = 1100;

export default function LandingPage({ ...props }: BoxProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [landingNavIsOpen, setLandingNavIsOpen] = useState(false);

  const fadeOut = () => {
    const explosion = elementRef.current;
    if (explosion) explosion.classList.add('hide');
  };

  const onHandleNavbarClick = () => {
    console.log('clicked', landingNavIsOpen);
    if (!landingNavIsOpen) {
      setTimeout(() => {
        fadeOut();
      }, ANIMATION_FADE_OUT_TIME);
    }

    setLandingNavIsOpen(!landingNavIsOpen);
  };
  return (
    <LayoutRootWrapper {...props} component={'div'} id='landing-root'>
      <LandingHeader landingNavIsOpen={landingNavIsOpen} />

      <Box sx={{ flex: '1 0 100%', display: 'flex' }}>
        <LandingSvgAnimation
          landingNavIsOpen={landingNavIsOpen}
          elementRef={elementRef}
          onHandleNavbarClick={onHandleNavbarClick}
        />
        {landingNavIsOpen && (
          <Box component={'section'} sx={{ flex: '1 1 auto' }}>
            <div>NEXT ITEM 1</div>
            <div>NEXT ITEM 2</div>
            <div>NEXT ITEM 3</div>
            <div>NEXT ITEM 4</div>
          </Box>
        )}
      </Box>
    </LayoutRootWrapper>
  );
}
