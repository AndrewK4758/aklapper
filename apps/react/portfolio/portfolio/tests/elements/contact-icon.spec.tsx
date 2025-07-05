import MenuOpen from '@mui/icons-material/MenuOpen';
import '@testing-library/jest-dom';
import ContactIcon from '../../src/components/header/contact/contact-icon.js';
import { render, screen } from '../utils/render_react_rotuter.js';

describe('test ContactIcon render role states', () => {
  it('should render with role of link', () => {
    render(
      <ContactIcon id={'contact-icon-id'} iconHref={'icon href'} generalId={'icon-test'} children={<MenuOpen />} />,
      { path: '/portfolio', initialRoute: '/portfolio' },
    );
    const element = screen.getByRole('link');
    expect(element).toBeInTheDocument();
  });

  it('should render with role of button', () => {
    render(<ContactIcon id={'contact-icon-id'} generalId={'icon-test'} children={<MenuOpen />} />, {
      path: '/portfolio',
      initialRoute: '/portfolio',
    });
    const element = screen.getByRole('button');
    expect(element).toBeInTheDocument();
  });
});
