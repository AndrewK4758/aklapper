import ButtonGroup from '@mui/material/ButtonGroup';
import AnimatedBorderBox from '../styled/animated_border_box';
import NavButton from './nav_button';

export default function NavBar() {
  return (
    <AnimatedBorderBox component={'nav'}>
      <ButtonGroup>
        <NavButton buttonText={'Home'} path='/portfolio' tooltipTitle={'Navigate home'} />
        <NavButton buttonText={'CRUD'} path='crud' tooltipTitle={'Navigate to CRUD app'} />
        <NavButton buttonText={'Games'} path='games' tooltipTitle={'Navigate to Games app'} />
        <NavButton buttonText={'Gen-AI'} path='gen-ai' tooltipTitle={'Navigate to Games app'} />
      </ButtonGroup>
    </AnimatedBorderBox>
  );
}
