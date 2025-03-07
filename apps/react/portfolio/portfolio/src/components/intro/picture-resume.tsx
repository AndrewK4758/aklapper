import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardMedia from '@mui/material/CardMedia';
import Tooltip from '@mui/material/Tooltip';
import { lazy, type JSX } from 'react';
// import resume from '../../assets/Resume.pdf';
// import myPic from '../../assets/self.webp';
import ResumeIcon from '../../components/icons/resume-icon.jsx';
import {
  introButtonSxProps,
  introIconSxProps,
  introPicStyles,
  picAndResumeCardStyles
} from '../../styles/intro-styles.jsx';
import Theme from '../../styles/theme';

const TechStackList = lazy(() => import('./tech-list/tech-list.jsx'));

/**
 * This component renders a card containing a picture of me and a button to download my resume.
 *
 * @returns {JSX.Element} The rendered picture and resume component.
 */

const PicutreAndResume = (): JSX.Element => (
  <Card
    key={'picture-and-resume-paper'}
    id={'picture-and-resume-paper'}
    data-testid={'picture-and-resume-paper'}
    sx={picAndResumeCardStyles}
  >
    <CardMedia
      component={'img'}
      key={'card-media-resume-image'}
      id={'card-media-resume-image'}
      data-testid={'card-media-resume-image'}
      src={'/client/self.webp'}
      loading="lazy"
      alt="andrew"
      sx={introPicStyles}
    />
    <CardActions key={'card-actions-wrapper'} id={'card-actions-wrapper'} data-testid={'card-actions-wrapper'}>
      <Tooltip title="Download my resume in PDF">
        <Button
          key={'card-media-resume-button'}
          id={'card-media-resume-button'}
          data-testid={'card-media-resume-button'}
          variant="contained"
          LinkComponent={'a'}
          href={'/client/Resume.pdf'}
          download={`andrew-klapper-resume`}
          endIcon={<ResumeIcon color={Theme.palette.mode === 'dark' ? '#000000' : '#FFFFFF'} sx={introIconSxProps} />}
          sx={introButtonSxProps}
        >
          Resume
        </Button>
      </Tooltip>
    </CardActions>
    <TechStackList />
  </Card>
);

export default PicutreAndResume;
