import MenuOpen from '@mui/icons-material/MenuOpen';
import { render } from '@testing-library/react';
import ContactIcon from '../src/components/header/contact/contact-icon.js';

describe('ContactIcon', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <ContactIcon
        id={'contact-icon-id'}
        iconHref={'icon href'}
        generalId={'icon-test'}
        children={<MenuOpen />}
      ></ContactIcon>,
    );
    expect(baseElement).toBeTruthy();
  });
});
