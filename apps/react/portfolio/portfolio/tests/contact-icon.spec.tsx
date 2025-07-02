import MenuOpen from '@mui/icons-material/MenuOpen';
import { render } from '@testing-library/react';
import ContactIcon from '../src/components/header/contact/contact-icon.js';

describe('ContactIcon', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <ContactIcon id={'contact-icon-id'} tooltipText={'tooltip text'} iconHref={'icon href'} Icon={<MenuOpen />} />,
    );
    expect(baseElement).toBeTruthy();
  });
});
