import { act, fireEvent, render, screen, type RenderResult } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router';
import Header from '../src/components/header/header';

let baseComponent: RenderResult;

describe('Test Header component', () => {
  beforeEach(async () => {
    act(() => {
      baseComponent = render(
        <BrowserRouter>
          <Header />
        </BrowserRouter>
      );
    });
    const contactMenuButton = await baseComponent.findByTestId('contact-menu-button');
    fireEvent.click(contactMenuButton);
  });

  it('Should test and pass all of the icon buttons', async () => {
    const github = await baseComponent.findByTestId('github-icon');
    const facebook = await baseComponent.findByTestId('facebook-icon');
    const linkedin = await baseComponent.findByTestId('linkedin-icon');
    const huggingFace = await baseComponent.findByTestId('hugging-face-icon');
    const x = await baseComponent.findByTestId('x-icon');
    const discord = await baseComponent.findByTestId('discord-icon');

    expect(github).toHaveAttribute('href', 'https://github.com/AndrewK4758/aklapper');
    expect(facebook).toHaveAttribute('href', 'https://www.facebook.com/AKlapper47');
    expect(linkedin).toHaveAttribute('href', 'https://www.linkedin.com/in/andrew-klapper-a9204b23b/');
    expect(huggingFace).toHaveAttribute('href', 'https://huggingface.co/ak475826');
    expect(x).toHaveAttribute('href', 'https://x.com/ak475826');
    expect(discord).toHaveAttribute('href', 'https://discord.com/users/989564035542446190');
  });

  it('Should test the email dialog opening', async () => {
    const emailButton = await baseComponent.findByTestId('email-icon');
    await act(async () => {
      emailButton.click();
    });

    expect(document.getElementById('email-dialog')).toBeInTheDocument();

    const tab1 = await baseComponent.findByTestId('appointment-request-tab');
    const tab2 = await baseComponent.findByTestId('email-me-tab');

    expect(await screen.findByRole('tab', { selected: true })).toEqual(tab1);
    expect(await screen.findByRole('tab', { selected: false })).toEqual(tab2);
  });
});
