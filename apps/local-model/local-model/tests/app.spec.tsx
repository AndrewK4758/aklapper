import '@testing-library/jest-dom';
import { render } from '@testing-library/react';

import App from '../src/app/app';
import { BrowserRouter } from 'react-router-dom';

describe('App', () => {
  it('should render successfully', () => {
    const baseComponent = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    const placeholder = baseComponent.getByText('Home Page Placeholder');
    expect(placeholder).toBeInTheDocument();
  });
});
