import type { Request, Response } from 'express';
import userTokensMap from '../../models/users-tokens-map.js';
import getCalendarClient from '../../services/calendar/calendar.js';
import oauth2Client from '../../services/google-oauth.js';

type StartAndEndTimes = {
  start: string;
  end: string;
};

const createEvents = async (req: Request, resp: Response) => {
  try {
    const userID: string = req.cookies['OAUID'];

    if (!userID)
      throw new ReferenceError('Google authorization not present. Please connect Google Calendar to continue.');

    const tokens = userTokensMap.get(userID);

    if (!tokens) {
      throw new Error('No token in user map');
    } else {
      const calendarClient = getCalendarClient(userID);

      const { start, end }: StartAndEndTimes = req.body;

      const result = await calendarClient.events.insert({
        auth: oauth2Client,
        calendarId: 'primary',
        requestBody: {
          summary: 'Meeting w/ Andrew Klapper',
          start: {
            dateTime: start,
          },
          end: {
            dateTime: end,
          },
          eventType: 'default',
          attendees: [
            {
              displayName: 'Andrew Klapper',
              email: 'andrew@andrew-k.us',
              comment:
                'Thanks for setting a time to get together. Please feel free to schedule a Google Meet video conference if that is your preference. If you need to reschedule, please update the event and I will respond with a confirmation.',
            },
          ],
          colorId: '2',
        },

        sendNotifications: true,
      });

      resp.status(201).json({ result });
    }
  } catch (e) {
    console.error(e);
    if (e instanceof ReferenceError) {
      resp.status(404).json({ message: e.message, name: e.name });
    }
  }
};

export default createEvents;
