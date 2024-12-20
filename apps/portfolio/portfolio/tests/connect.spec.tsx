import { render } from '@testing-library/react';

import Connect from '../src/components/header/connect/connect';

describe('Connect', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Connect />);
    expect(baseElement).toBeTruthy();
  });
});
