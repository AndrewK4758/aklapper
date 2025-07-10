import '@testing-library/jest-dom';
import ContactDialog from '../../src/components/contact/contact_dialog';
import { fireEvent, render, ROUTES, screen } from '../utils/render_react_rotuter';

let isOpen: boolean, mockOnClose: () => void;

describe('test contact dialog', () => {
  beforeEach(() => {
    isOpen = true;
    mockOnClose = vi.fn();

    render(
      <body>
        <ContactDialog isOpen={isOpen} handleIsOpen={mockOnClose} />
      </body>,
      {
        path: ROUTES.PORTFOLIO,
        initialRoute: ROUTES.PORTFOLIO,
      },
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be in document', async () => {
    const element = await screen.findByTestId('contact-dialog');

    expect(element).toBeInTheDocument();
  });

  it('should have appointment tab selected', async () => {
    const tab1TestId = 'appointment-request-tab';
    const tab2TestId = 'email-me-tab';

    const tab1 = await screen.findByTestId(tab1TestId);
    const tab2 = await screen.findByTestId(tab2TestId);

    expect(tab1).toHaveAttribute('aria-selected', 'true');
    expect(tab2).toHaveAttribute('aria-selected', 'false');
  });

  it('should have email-me tab selected', async () => {
    const tab1TestId = 'appointment-request-tab';
    const tab2TestId = 'email-me-tab';

    const tab1 = await screen.findByTestId(tab1TestId);
    const tab2 = await screen.findByTestId(tab2TestId);

    fireEvent.click(tab2);

    expect(tab2).toHaveAttribute('aria-selected', 'true');
    expect(tab1).toHaveAttribute('aria-selected', 'false');
  });

  it('should close the dialog', async () => {
    const closeDialogTestId = 'close-contact';

    const closeButton = screen.getByTestId(closeDialogTestId);

    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
