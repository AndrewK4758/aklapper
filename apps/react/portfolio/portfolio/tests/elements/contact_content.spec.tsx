import '@testing-library/jest-dom';
import ContactContent from '../../src/components/contact/dialog/contact_content';
import DialogLayout from '../../src/components/contact/dialog/dialog_layout';
import { render, ROUTES, screen } from '../utils/render_react_rotuter';

const waitingTestId = 'waiting-image';
let mockHandleIsOpen: () => void;

describe('test contact content', () => {
  beforeEach(() => {
    mockHandleIsOpen = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
  it('should render the fallback element on initial load', () => {
    render(<ContactContent tab={0} handleIsOpen={mockHandleIsOpen} />, {
      initialRoute: ROUTES.PORTFOLIO,
      path: ROUTES.PORTFOLIO,
    });

    const waitingImage = screen.getByTestId(waitingTestId);

    expect(waitingImage).toBeInTheDocument();
    expect(waitingImage).toBeVisible();
  });

  it('should render the google calendar element', async () => {
    const googleCalendarWrapperId = 'google-calendar-wrapper';

    const { findByTestId } = render(
      <DialogLayout isOpen={true}>
        <ContactContent tab={0} handleIsOpen={mockHandleIsOpen} />
      </DialogLayout>,
      {
        initialRoute: ROUTES.PORTFOLIO,
        path: ROUTES.PORTFOLIO,
      },
    );

    const googleCalendar = await findByTestId(googleCalendarWrapperId);

    expect(googleCalendar).toBeInTheDocument();

    // expect(screen.queryByTestId(waitingTestId)).not.toBeInTheDocument();
  });
});
