import axios from 'axios';
import type { TimesAndDates } from '../../types/types';

//TODO - move to services directory
const baseURL = import.meta.env.VITE_PORTFOLIO_API_URL;

export default async function handleSubmitCalendarEvent(
  { date, startTime, endTime }: TimesAndDates,
  setOpen: (isOpen: boolean) => void,
): Promise<void> {
  try {
    if (date && startTime && endTime) {
      const endTimeFormatted = startTime.add(endTime, 'minutes');

      const startDateTime = startTime.toISOString();
      const endDateTime = endTimeFormatted.toISOString();

      const result = await axios.post(
        `${baseURL}/create-events`,
        { start: startDateTime, end: endDateTime },
        {
          withCredentials: true,
        },
      );

      if (result) setOpen(false);
    }
  } catch (error) {
    console.error(error);
    alert('Error submitting event, Please try again');
  }
}
