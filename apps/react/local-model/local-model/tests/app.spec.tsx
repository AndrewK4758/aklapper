import '@testing-library/jest-dom';
import { render } from '@testing-library/react';

import App from '../src/app/app';

describe('App', () => {
  it('should render successfully', () => {
    const baseComponent = render(<App />);

    const placeholder = baseComponent.getByText('AI Chatbot w/ RAG, Web Search, and History');
    expect(placeholder).toBeInTheDocument();
  });
});
