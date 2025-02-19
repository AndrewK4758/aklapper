import '@testing-library/jest-dom';
import { render } from '@testing-library/react';

import App from '../src/app/app';

describe('App', () => {
  it('should render successfully', () => {
    const baseComponent = render(<App />);

    const placeholder = baseComponent.getByText('Home Page Placeholder');
    expect(placeholder).toBeInTheDocument();
  });
});
