import { useNavigate } from 'react-router';
import AnimatedBorderBox from '../styled/animated_border_box.js';
import NavButton from './nav_button.js';

export default function NavBar() {
  const nav = useNavigate();

  const handleNavButtonClick = (path: string) => {
    nav(path, { relative: 'route' });
  };

  return (
    <AnimatedBorderBox sx={{ display: 'flex', justifyContent: 'space-evenly' }}>
      <NavButton
        buttonText={'Home'}
        name='/portfolio'
        variant='outlined'
        tooltipTitle={'Navigate home'}
        onClick={e => handleNavButtonClick(e.currentTarget.name)}
      />
      <NavButton
        buttonText={'CRUD'}
        name='crud'
        variant='outlined'
        tooltipTitle={'Navigate to CRUD app'}
        onClick={e => handleNavButtonClick(e.currentTarget.name)}
      />
      <NavButton
        buttonText={'Games'}
        name='games'
        variant='outlined'
        tooltipTitle={'Navigate to Games app'}
        onClick={e => handleNavButtonClick(e.currentTarget.name)}
      />
      <NavButton
        buttonText={'Gen-AI'}
        name='gen-ai'
        variant='outlined'
        tooltipTitle={'Navigate to Games app'}
        onClick={e => handleNavButtonClick(e.currentTarget.name)}
      />
    </AnimatedBorderBox>
  );
}
