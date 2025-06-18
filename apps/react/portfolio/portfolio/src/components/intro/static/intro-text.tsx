import Link from '@mui/material/Link';
import Typography, { type TypographyProps } from '@mui/material/Typography';
import Theme from '../../../styles/theme.jsx';

export const ABOUT_ME_TITLE = "Hi, I'm Andrew Klapper";

const ID = 'intro-text';

export const IntroText = ({ ...props }: TypographyProps) => (
  <Typography {...props} variant='h5' id={ID} data-testid={ID} textAlign={'inherit'} borderRight={0}>
    I'm a full-stack web developer with 3 years experience developing & deploying web based applications & interactive
    websites. I specialize in <b>Monorepo Architectures</b>, <b>Cloud Deployments</b>, custom <b>React Components</b>,{' '}
    <b>Dynamic API Design</b>, & thorough <b>Testing</b>. I have a work ethic & focused determination which thrives in
    fast-paced environments. Increasing efficiency & delivering robust, end-to-end solutions while applying best
    practices with new technologies are what I enjoy the most. My ideal positions are collaborative environments that
    tackle complex challenges & delivering high-quality solutions that add value to any team.
    <br />
    <br />
    Beyond my technical skills, I'm an active member of{' '}
    <b>
      <Link
        rel='noreferrer noopener'
        target='_blank'
        href='https://woodstock.dev'
        id='wdg-link'
        data-testid='wdg-link'
        sx={{
          color: Theme.palette.secondary.main,
          '&:hover': {
            color: Theme.palette.secondary.contrastText,
          },
        }}
      >
        Woodstock Developers Group
      </Link>
      {', '}
    </b>
    where I continue learning and trying new technologies while helping others & staying abreast of the latest industry
    trends. In my free time, I enjoy pursuing outdoor activities, such as: camping, fishing, growing a small vegetable
    garden & working on my project truck. These help me maintain a balanced lifestyle & foster a creative approach to
    problem-solving. I'm excited to bring my passion & skills to a team where I can contribute to meaningful projects &
    continue to grow as a developer.
  </Typography>
);
