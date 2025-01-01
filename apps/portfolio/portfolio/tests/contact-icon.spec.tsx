import { render } from '@testing-library/react';
import MenuOpen from '@mui/icons-material/MenuOpen';
import ContactIcon from '../src/components/header/contact-icon/contact-icon';

describe('ContactIcon', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<ContactIcon id={''} tooltipText={''} iconHref={''} Icon={<MenuOpen />} />);
    expect(baseElement).toBeTruthy();
  });
});
