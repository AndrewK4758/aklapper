import cookieParser from 'cookie-parser';
import express, { Router } from 'express';
import multer from 'multer';
import createEvents from '../controllers/calendar/create-event.js';
import createTokens from '../controllers/create-google-tokens.js';
import postEmail from '../controllers/post-email.js';

const router: Router = Router();

export const uploadStorage = multer.memoryStorage();
export const upload = multer({ storage: uploadStorage });

export class PortfolioRoutes {
  constructor() {
    router.use(cookieParser());
    router.use(express.json({ limit: '50mb' }));
    router.use(express.urlencoded({ extended: true, limit: '50mb' }));

    //-------------------------------------------------//

    router.get('/', (_, resp) => {
      resp.status(201).send('healthy');
    });
    router.post('/email', upload.single('attachment'), postEmail);
    router.post('/create-tokens', createTokens);
    router.post('/create-events', createEvents);
  }
}

export default router;
