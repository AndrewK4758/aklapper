import Theme from '../../../styles/theme';
import Box from '@mui/material/Box';
import { Link } from 'react-router-dom';

export const ABOUT_ME_TITLE = "Hi, I'm Andrew Klapper";

export const IntroText = () => (
  <Box component={'span'} id="intro-text" data-testid="intro-text" key={'intro-text'}>
    A highly motivated full-stack web developer with 3 years of personal experience developing (not so much visually
    designing), and deploying web based applications and projects which provide a solid foundation in the principles of
    web technologies and problem solving. Some of the projects are here for you to try. Hover over each link above for a
    short description, and click the links to try them out and learn what decisions I chose to make each what you will
    see. I enjoy collaborative environments and possess a strong work ethic, always eager to learn new technologies and
    contribute to projects. My technical strengths encompasses a wide range of tools and technologies, which are listed
    below. I'm confident in my ability to tackle complex challenges, deliver high-quality solutions, and add value to
    any team. <br />
    <br />
    Beyond my technical skills, I'm an active member of the{' '}
    <strong>
      <Link
        key={'link-to-woodstock.dev'}
        rel="noreferrer noopener"
        target="_blank"
        to="https://woodstock.dev"
        id="link-to-woodstock.dev"
        data-testid="link-to-woodstock.dev"
        style={{
          color: Theme.palette.secondary.main
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = Theme.palette.secondary.contrastText;
          e.currentTarget.style.backgroundColor = Theme.palette.secondary.main;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = Theme.palette.secondary.main;
          e.currentTarget.style.backgroundColor = Theme.palette.background.paper;
        }}
      >
        Woodstock Developers Group
      </Link>{' '}
    </strong>
    (WDG), where I mentor others and stay abreast of the latest industry trends. In my free time, I enjoy pursuing
    diverse interests like generative AI & and outdoor activities, such as: camping, fishing, and working on my project
    truck; which help me maintain a balanced lifestyle and foster a creative approach to problem-solving. I'm excited to
    bring my passion and skills to a team where I can contribute to meaningful projects and continue to grow as a
    developer.
  </Box>
);
