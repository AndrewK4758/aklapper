import { useNavigate } from 'react-router';
import NavButton from '../../navigation/nav_button';
import AnimatedBorderBox from '../../styled/animated_border_box';

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
        onClick={e => handleNavButtonClick(e.currentTarget.name)}
      />
      <NavButton
        buttonText={'CRUD'}
        name='crud'
        variant='outlined'
        onClick={e => handleNavButtonClick(e.currentTarget.name)}
      />
      <NavButton
        buttonText={'Games'}
        name='games'
        variant='outlined'
        onClick={e => handleNavButtonClick(e.currentTarget.name)}
      />
      <NavButton
        buttonText={'Gen-AI'}
        name='gen-ai'
        variant='outlined'
        onClick={e => handleNavButtonClick(e.currentTarget.name)}
      />
    </AnimatedBorderBox>
  );
}
