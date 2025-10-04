import type { Request, Response } from 'express';
import userTokensMap from '../../models/users-tokens-map.js';
import getCalendarClient from '../../services/calendar/calendar.js';
import oauth2Client from '../../services/google-oauth.js';

export default async function getEvents(req: Request, resp: Response) {
  try {
    const userID: string = req.cookies['OAUID'];

    if (!userID)
      throw new ReferenceError('Google authorization not present. Please connect Google Calendar to continue.');

    const tokens = userTokensMap.get(userID);

    if (!tokens) throw new ReferenceError('No token in user map');

    const calendarClient = getCalendarClient(userID);

    const date = new Date();

    const events = await calendarClient.events.list({
      calendarId: 'primary',
      auth: oauth2Client,
      prettyPrint: true,
      timeMin: new Date(date.setUTCMonth(date.getUTCMonth(), 1)).toISOString(),
    });

    console.log(JSON.stringify(events, null, 2));

    resp.status(200).json({ events: events.data.items });
  } catch (e) {
    console.error(e);
    if (e instanceof ReferenceError) {
      resp.status(404).json({ message: e.message, name: e.name });
    }
  }

  return;
}
