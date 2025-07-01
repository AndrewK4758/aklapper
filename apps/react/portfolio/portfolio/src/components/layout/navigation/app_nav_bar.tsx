import ButtonGroup from '@mui/material/ButtonGroup';
import AnimatedBorderBox from '../../styled/animated_border_box.js';
import NavButton from './nav_button.js';

export default function AppNavBar() {
  return (
    <AnimatedBorderBox as={'nav'} id='app-nav-bar'>
      <ButtonGroup>
        <NavButton buttonText={'Home'} name='/portfolio' />
        <NavButton buttonText={'CRUD'} name='crud' />
        <NavButton buttonText={'Games'} name='games' />
        <NavButton buttonText={'Gen-AI'} name='gen-ai' />
      </ButtonGroup>
    </AnimatedBorderBox>
  );
}
