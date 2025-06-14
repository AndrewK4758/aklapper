import type { CorsOptions } from 'cors';
import cors from 'cors';
import type { Express, Request, Response } from 'express';
import express from 'express';
import render from './src/main-server.tsx';
import './src/styles/main-styles.css';

const envPort = process.env.PORT;
const PORT = envPort ? parseInt(envPort) : 4700;

const app: Express = express();

const corsOptions: CorsOptions = {
  origin: ['http://localhost:5800', 'http://localhost', 'http://localhost:4800', 'http://localhost:4700'],
};

app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));

app.use(express.static('dist'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get(/.*/, async (req: Request, resp: Response) => {
  try {
    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;

    console.log(`FULL URL: ${fullUrl}`);

    await render(fullUrl, resp);
  } catch (error) {
    console.error(error);
  }
});

const server = app.listen(PORT, () => {
  console.log(`Serving Portfolio on PORT: ${PORT}`);
});

server.on('error', console.error);
