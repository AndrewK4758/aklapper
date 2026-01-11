import { createRoot } from 'react-dom/client';
import App from '@app/app';

const root = document.querySelector('#root') as HTMLDivElement;

createRoot(root).render(<App />);
