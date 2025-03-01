import Box from '@mui/material/Box';
import { Link } from 'react-router';
import Theme from '../../../styles/theme.jsx';

export const ABOUT_ME_TITLE = "Hi, I'm Andrew Klapper";

export const IntroText = () => (
  <Box component={'div'} id="intro-text" data-testid="intro-text" key={'intro-text'}>
    A am a full-stack web developer with 3 years of personal experience developing & deploying web based applications &
    projects. I specialize in <strong style={{ fontFamily: 'Lucida Bold' }}>Monorepo Architectures</strong>,{' '}
    <strong style={{ fontFamily: 'Lucida Bold' }}>Cloud Deployments</strong>, custom{' '}
    <strong style={{ fontFamily: 'Lucida Bold' }}>React Components</strong>, &{' '}
    <strong style={{ fontFamily: 'Lucida Bold' }}>Dynamic OOP Patterns</strong>. My strengths are{' '}
    <strong style={{ fontFamily: 'Lucida Bold' }}>Typescript</strong>,{' '}
    <strong style={{ fontFamily: 'Lucida Bold' }}>Nodejs</strong>,{' '}
    <strong style={{ fontFamily: 'Lucida Bold' }}>Python</strong>,{' '}
    <strong style={{ fontFamily: 'Lucida Bold' }}>React</strong>,{' '}
    <strong style={{ fontFamily: 'Lucida Bold' }}>PostgreSQL</strong>,{' '}
    <strong style={{ fontFamily: 'Lucida Bold' }}>MongoDB</strong>,{' '}
    <strong style={{ fontFamily: 'Lucida Bold' }}>Nx</strong>,{' '}
    <strong style={{ fontFamily: 'Lucida Bold' }}>API Design</strong>,{' '}
    <strong style={{ fontFamily: 'Lucida Bold' }}>Gen-AI Agents & Prompts</strong>. I utilize{' '}
    <strong style={{ fontFamily: 'Lucida Bold' }}>Docker</strong>,{' '}
    <strong style={{ fontFamily: 'Lucida Bold' }}>Github Actions</strong>, &{' '}
    <strong style={{ fontFamily: 'Lucida Bold' }}>GCP AppEngine & Cloud Run</strong> for my{' '}
    <strong style={{ fontFamily: 'Lucida Bold' }}>CI/CD Pipeline</strong>. I have a strong work ethic & focused
    determination which thrives in fast-paced environments. Increasing efficiency & delivering robust, end-to-end
    solutions & applying best practices with new technologies are what I enjoy the most. I enjoy collaborative
    environments & tackling complex challenges, delivering high-quality solutions, & adding value to any team.
    <br />
    <br />
    Beyond my technical skills, I'm an active member of the{' '}
    <strong style={{ fontFamily: 'Lucida Bold' }}>
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
    (WDG), where I mentor others & stay abreast of the latest industry trends. In my free time, I enjoy pursuing diverse
    interests like generative AI & & outdoor activities, such as: camping, fishing, & working on my project truck; which
    help me maintain a balanced lifestyle & foster a creative approach to problem-solving. I'm excited to bring my
    passion & skills to a team where I can contribute to meaningful projects & continue to grow as a developer.
  </Box>
);
