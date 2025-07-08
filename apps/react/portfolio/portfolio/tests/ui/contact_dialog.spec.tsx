import '@testing-library/jest-dom';
import ContactDialog from '../../src/components/contact/contact_dialog';
import { render, ROUTES, screen } from '../utils/render_react_rotuter';

let isOpen: boolean, handleIsOpen: () => void;

describe('test contact dialog', () => {
  beforeEach(async () => {
    isOpen = true;

    handleIsOpen = () => {
      isOpen = !isOpen;
    };

    render(<ContactDialog isOpen={isOpen} handleIsOpen={handleIsOpen} />, {
      path: ROUTES.PORTFOLIO,
      initialRoute: ROUTES.PORTFOLIO,
    });
  });

  it('should pass', async () => {
    handleIsOpen();

    const element = await screen.findByTestId('contact-dialog');

    expect(element).toBeInTheDocument();
  });
});
