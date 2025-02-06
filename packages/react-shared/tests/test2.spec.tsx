import { render } from '@testing-library/react';

describe('Test Waiting Component', () => {
  it('Should Pass', () => {
    const baseComponent = render(<h1>TEST2</h1>);
    expect(baseComponent).toBeTruthy();
  });
});
