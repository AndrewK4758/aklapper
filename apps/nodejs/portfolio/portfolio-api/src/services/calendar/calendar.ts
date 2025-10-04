import { google } from 'googleapis';
import userTokensMap from '../../models/users-tokens-map.js';
import oauth2Client from '../google-oauth.js';

export default function getCalendarClient(userID: string) {
  const tokens = userTokensMap.get(userID);

  if (!tokens) throw new Error('No token in user map');
  else {
    const refreshToken = tokens.refresh_token;

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    return google.calendar('v3');
  }
}
