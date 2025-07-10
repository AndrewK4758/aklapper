import type { NextFunction, Request, Response } from 'express';
import ShortUniqueId from 'short-unique-id';
import userTokensMap from '../models/users-tokens-map.js';
import oauth2Client from '../services/google-oauth.js';

const createTokens = async (req: Request, resp: Response, next: NextFunction) => {
  try {
    const { code } = req.body;

    const { tokens } = await oauth2Client.getToken(code);
    const userID = new ShortUniqueId().rnd();

    userTokensMap.set(userID, tokens);

    resp.cookie('OAUID', userID, {
      maxAge: 1000 * 60 * 5,
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    });

    const origin = process.env.NODE_ENV === 'production' ? 'https://www.andrew-k.us' : 'http://localhost:4700';
    resp.setHeader('Access-Control-Allow-Origin', origin);
    resp.setHeader('Access-Control-Allow-Credentials', 'true');

    const googleOAuthResp = { idToken: tokens.id_token };

    resp.status(201).json(googleOAuthResp);
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export default createTokens;
