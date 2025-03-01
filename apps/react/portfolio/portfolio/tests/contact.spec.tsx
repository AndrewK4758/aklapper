import { render } from '@testing-library/react';

import Contact from '../src/components/header/contact/contact';

describe('Contact', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Contact openMenu={false} setOpenMenu={() => true} />);
    expect(baseElement).toBeTruthy();
  });
});
