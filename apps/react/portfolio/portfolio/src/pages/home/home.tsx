import Box, { type BoxProps } from '@mui/material/Box';
import { type ReactElement } from 'react';
// import PicutreAndResume from '../../components/intro/picture-resume.jsx';
import ArrowRight from '@mui/icons-material/ArrowRightRounded';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardHeader from '@mui/material/CardHeader';
import CardMedia from '@mui/material/CardMedia';
import Intro from '../../components/intro/intro';
import { ABOUT_ME_TITLE } from '../../components/intro/static/intro-text.js';
import StyledRootComponentWrapper from '../../components/styled/styled_root_wrapper.js';
import Theme from '../../styles/theme.js';

/**
 * This is the main home component that renders the introduction section of the portfolio website.
 * It includes a brief introduction, a picture with a resume download button, and a list of technologies I am familiar with.
 *
 * @returns {ReactElement} The rendered home component.
 */

const Home = ({ ...props }: BoxProps): ReactElement => (
  <StyledRootComponentWrapper
    {...props}
    sx={{
      [Theme.breakpoints.up('lg')]: {
        flexDirection: 'row',
      },
    }}
  >
    <Intro />
    {/* <PicutreAndResume /> */}

    {/* <Box sx={{ height: 'fit-content' }}>
      <Card sx={{}}>
        <CardActionArea>
          <CardHeader title={ABOUT_ME_TITLE} />
        </CardActionArea>
        <CardMedia />
      </Card> */}
    {/* </Box> */}
  </StyledRootComponentWrapper>
);

export default Home;
