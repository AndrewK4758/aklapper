import Typography from '@mui/material/Typography';
import { Link } from 'react-router';
import Theme from '../../../styles/theme.jsx';

export const ABOUT_ME_TITLE = "Hi, I'm Andrew Klapper";

const ID = 'intro-text';

export const IntroText = () => (
  <Typography variant='body1' id={ID} data-testid={ID} textAlign={'justify'}>
    A am a full-stack web developer with 3 years of personal experience developing & deploying web based applications &
    projects. I specialize in <span className='bold-text'>Monorepo Architectures</span>,{' '}
    <span className='bold-text'>Cloud Deployments</span>, custom <span className='bold-text'>React Components</span>, &{' '}
    <span className='bold-text'>Dynamic OOP Patterns</span>. My strengths are{' '}
    <span className='bold-text'>Typescript</span>, <span className='bold-text'>Nodejs</span>,{' '}
    <span className='bold-text'>Python</span>, <span className='bold-text'>React</span>,{' '}
    <span className='bold-text'>PostgreSQL</span>, <span className='bold-text'>MongoDB</span>,{' '}
    <span className='bold-text'>Nx</span>, <span className='bold-text'>API Design</span>,{' '}
    <span className='bold-text'>Gen-AI Agents & Prompts</span>. I utilize <span className='bold-text'>Docker</span>,{' '}
    <span className='bold-text'>Github Actions</span>, & <span className='bold-text'>GCP AppEngine & Cloud Run</span>{' '}
    for my <span className='bold-text'>CI/CD Pipeline</span>. I have a work ethic & focused determination which thrives
    in fast-paced environments. Increasing efficiency & delivering robust, end-to-end solutions & applying best
    practices with new technologies are what I enjoy the most. I enjoy collaborative environments & tackling complex
    challenges, delivering high-quality solutions, & adding value to any team.
    <br />
    <br />
    Beyond my technical skills, I'm an active member of the{' '}
    <span className='bold-text'>
      <Link
        key={'link-to-woodstock.dev'}
        rel='noreferrer noopener'
        target='_blank'
        to='https://woodstock.dev'
        id='link-to-woodstock.dev'
        data-testid='link-to-woodstock.dev'
        style={{
          color: Theme.palette.secondary.main,
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
    </span>
    (WDG), where I mentor others & stay abreast of the latest industry trends. In my free time, I enjoy pursuing diverse
    interests like generative AI & outdoor activities, such as: camping, fishing, & working on my project truck; which
    help me maintain a balanced lifestyle & foster a creative approach to problem-solving. I'm excited to bring my
    passion & skills to a team where I can contribute to meaningful projects & continue to grow as a developer.
  </Typography>
);
