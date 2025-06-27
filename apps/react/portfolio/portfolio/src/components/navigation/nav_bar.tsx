import ButtonGroup from '@mui/material/ButtonGroup';
import AnimatedBorderBox from '../styled/animated_border_box';
import NavButton from './nav_button';

export default function NavBar() {
  return (
    <AnimatedBorderBox as={'nav'}>
      <ButtonGroup>
        <NavButton buttonText={'Home'} path='/portfolio' />
        <NavButton buttonText={'CRUD'} path='crud' />
        <NavButton buttonText={'Games'} path='games' />
        <NavButton buttonText={'Gen-AI'} path='gen-ai' />
      </ButtonGroup>
    </AnimatedBorderBox>
  );
}
