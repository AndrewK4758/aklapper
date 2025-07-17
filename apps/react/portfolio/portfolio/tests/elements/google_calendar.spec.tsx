import '@testing-library/jest-dom';
import DialogLayout from '../../src/components/contact/dialog/dialog_layout';
import GoogleCalendar from '../../src/components/contact/google-calendar/google-calendar';
import { render, ROUTES, screen } from '../utils/render_react_rotuter';

describe('test google calendar element and appoitment maker functionality', () => {
  it('should render the correct elements on the screen', async () => {
    const TEST_ID = 'google-calendar-wrapper';
    const currentDate = new Date();
    const tom = currentDate.setDate(currentDate.getDate() + 1);
    const MONTH_AND_YEAR = `${currentDate.toLocaleString('default', { month: 'long' })} ${currentDate.getFullYear()}`;
    const TOMORROW = `${new Date(tom).toLocaleDateString('default', { day: '2-digit' })}`;
    const meetingTimeDefault = 'hh:mm aa';
    const meetingLengthDefault = '0';

    render(
      <DialogLayout isOpen={true}>
        <GoogleCalendar
          setOpen={() => {
            return;
          }}
        />
      </DialogLayout>,
      { initialRoute: ROUTES.PORTFOLIO, path: ROUTES.PORTFOLIO },
    );

    const rootElement = await screen.findByTestId(TEST_ID, {}, { timeout: 2500 });
    const year = await screen.findByText(MONTH_AND_YEAR, {}, { timeout: 2500 });
    const day = await screen.findByRole('gridcell', { selected: true });
    const meetingTime = await screen.findByPlaceholderText(meetingTimeDefault);
    const meetingLength = await screen.findByDisplayValue(meetingLengthDefault);

    expect(rootElement).toBeInTheDocument();
    expect(year).toBeInTheDocument();
    expect(day).toHaveAttribute('tabindex', '0');
    expect(day).toHaveTextContent(TOMORROW);
    expect(meetingTime).toHaveValue('08:30 AM');
    expect(meetingLength).not.toBeVisible();
  });
});
