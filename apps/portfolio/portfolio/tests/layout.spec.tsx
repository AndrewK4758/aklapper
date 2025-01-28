import '@testing-library/jest-dom';
import { act, render, screen, type RenderResult } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import Layout from '../src/components/layout/layout';

let baseComponent: RenderResult;

describe('Test Layout Component', () => {
  beforeEach(() => {
    act(() => {
      baseComponent = render(
        <BrowserRouter>
          <Layout />
        </BrowserRouter>
      );
    });
  });

  it('Should render the app-wrapper div', async () => {
    const appWrapper = await baseComponent.findByTestId('app-wrapper');

    expect(appWrapper).toHaveAttribute('id', 'app-wrapper');
  });

  it('Should render the main component', async () => {
    const mainDiv = await baseComponent.findByTestId('main-wrapper');
    expect(mainDiv).toContainElement(await screen.findByTestId('home-wrapper'));
  });

  it('Should reder the footer div', async () => {
    const footerDiv = await baseComponent.findByTestId('footer-wrapper');
    expect(footerDiv).toContainElement(await screen.findByTestId('privacy-policy-link'));
  });

  it('Should render the link to Privacy Policy', async () => {
    const privacyPolicy = await baseComponent.findByTestId('privacy-policy-link');
    expect(privacyPolicy).toHaveAttribute('href', '/privacy-policy');
  });
});
