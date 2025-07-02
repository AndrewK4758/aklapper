import { render } from '@testing-library/react';

import Contact from '../src/components/header/header.js';

describe('Contact', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Contact openMenu={false} setOpenMenu={() => true} />);
    expect(baseElement).toBeTruthy();
  });
});
