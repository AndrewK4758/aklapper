import { Link } from 'react-router';
import Theme from '../../../styles/theme.jsx';
import Box from '@mui/material/Box';

export const ABOUT_ME_TITLE = "Hi, I'm Andrew Klapper";

export const IntroText = () => (
  <Box component={'p'} id="intro-text" data-testid="intro-text" key={'intro-text'}>
    A am a full-stack web developer with 3 years of personal experience developing & deploying web based applications &
    projects. I specialize in <strong className="bold-text">Monorepo Architectures</strong>,{' '}
    <strong className="bold-text">Cloud Deployments</strong>, custom{' '}
    <strong className="bold-text">React Components</strong>, &{' '}
    <strong className="bold-text">Dynamic OOP Patterns</strong>. My strengths are{' '}
    <strong className="bold-text">Typescript</strong>, <strong className="bold-text">Nodejs</strong>,{' '}
    <strong className="bold-text">Python</strong>, <strong className="bold-text">React</strong>,{' '}
    <strong className="bold-text">PostgreSQL</strong>, <strong className="bold-text">MongoDB</strong>,{' '}
    <strong className="bold-text">Nx</strong>, <strong className="bold-text">API Design</strong>,{' '}
    <strong className="bold-text">Gen-AI Agents & Prompts</strong>. I utilize{' '}
    <strong className="bold-text">Docker</strong>, <strong className="bold-text">Github Actions</strong>, &{' '}
    <strong className="bold-text">GCP AppEngine & Cloud Run</strong> for my{' '}
    <strong className="bold-text">CI/CD Pipeline</strong>. I have a strong work ethic & focused determination which
    thrives in fast-paced environments. Increasing efficiency & delivering robust, end-to-end solutions & applying best
    practices with new technologies are what I enjoy the most. I enjoy collaborative environments & tackling complex
    challenges, delivering high-quality solutions, & adding value to any team.
    <br />
    <br />
    Beyond my technical skills, I'm an active member of the{' '}
    <strong className="bold-text">
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
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = Theme.palette.secondary.main;
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
