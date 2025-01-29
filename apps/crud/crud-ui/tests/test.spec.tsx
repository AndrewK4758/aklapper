import { render } from '@testing-library/react';
import Layout from '../src/pages/layout/layout';
import { BrowserRouter } from 'react-router';

describe('HomePage', () => {
  it('Should Pass', () => {
    const baseComponent = render(
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    );

    expect(baseComponent).toBeTruthy();
  });
});
