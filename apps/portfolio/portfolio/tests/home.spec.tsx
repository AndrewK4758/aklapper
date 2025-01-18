import '@testing-library/jest-dom';
import { render, type RenderResult } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Home from '../src/pages/home/home';
// import Intro from '../src/components/intro/intro';
import { ABOUT_ME_TITLE } from '../src/components/intro/static/intro-text';

let baseComponent: RenderResult;

describe('Test Home Component', async () => {
  beforeEach(() => {
    baseComponent = render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );
  });

  it('Shoulld pass', async () => {
    const home = await baseComponent.findByTestId('home');

    expect(home).toBeTruthy();
  });

  it('Should show intro h1 title', async () => {
    const introTitle = await baseComponent.findByTestId('about-me-title-text');

    expect(introTitle).toHaveTextContent(ABOUT_ME_TITLE);
  });

  it('Should show intro text', async () => {
    const introTextData = await baseComponent.findByTestId('about-me-text');
    const introTextLink = await baseComponent.findByTestId('link-to-woodstock.dev');

    expect(introTextData).toHaveRole('paragraph');
    expect(introTextLink).toHaveRole('link');
    expect(introTextLink).toHaveTextContent('Woodstock Developers Group');
  });

  it('Shoud show Picture & Resume text and image data', async () => {
    const resumePic = await baseComponent.findByTestId('card-media-resume-image');
    const resumeButton = await baseComponent.findByTestId('card-media-resume-button');

    expect(resumePic).toHaveAttribute('src', '/src/assets/self.webp');
    expect(resumePic).toHaveAttribute('alt', 'andrew');

    expect(resumeButton).toHaveTextContent('Resume');
    expect(resumeButton).toHaveAttribute('href', '/src/assets/Resume.pdf');
    expect(resumeButton).toHaveAttribute('download', `andrew-klapper-resume-${new Date().toLocaleDateString()}`);
  });
});
