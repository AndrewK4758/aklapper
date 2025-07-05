import ButtonGroup from '@mui/material/ButtonGroup';
import AnimatedBorderBox from '../../styled/animated_border_box.js';
import NavButton from './nav_button.js';

export default function AppNavBar() {
  return (
    <AnimatedBorderBox as={'nav'} id='app-nav-bar'>
      <ButtonGroup>
        <NavButton buttonText={'Home'} name='/portfolio' data-testid='home-nav-button' />
        <NavButton buttonText={'CRUD'} name='crud' data-testid='crud-nav-button' />
        <NavButton buttonText={'Games'} name='games' data-testid='games-nav-button' />
        <NavButton buttonText={'Gen-AI'} name='gen-ai' data-testid='gen-ai-nav-button' />
      </ButtonGroup>
    </AnimatedBorderBox>
  );
}
