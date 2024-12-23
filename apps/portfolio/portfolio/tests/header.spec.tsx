import { act, fireEvent, render, screen, type RenderResult } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import Header from '../src/components/header/header';

let baseComponent: RenderResult;

describe('Test Header component', () => {
  beforeEach(() => {
    baseComponent = render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );

    const contactMenuButton = baseComponent.getByTestId('contact-menu-button');
    fireEvent.click(contactMenuButton);
  });

  it('Should test and pass all of the icon buttons', () => {
    const github = baseComponent.getByTestId('github-icon');
    const facebook = baseComponent.getByTestId('facebook-icon');
    const linkedin = baseComponent.getByTestId('linkedin-icon');
    const huggingFace = baseComponent.getByTestId('hugging-face-icon');
    const x = baseComponent.getByTestId('x-icon');
    const discord = baseComponent.getByTestId('discord-icon');

    expect(github).toHaveAttribute('href', 'https://github.com/AndrewK4758');
    expect(facebook).toHaveAttribute('href', 'https://www.facebook.com/AKlapper47');
    expect(linkedin).toHaveAttribute('href', 'https://www.linkedin.com/in/andrew-klapper-a9204b23b/');
    expect(huggingFace).toHaveAttribute('href', 'https://huggingface.co/ak475826');
    expect(x).toHaveAttribute('href', 'https://x.com/ak475826');
    expect(discord).toHaveAttribute('href', 'https://discord.com/users/989564035542446190');
  });

  it('Should test the email dialog opening', async () => {
    const emailButton = baseComponent.getByTestId('email-icon');
    await act(async () => {
      emailButton.click();
    });

    expect(document.getElementById('email-dialog')).toBeInTheDocument();

    const tab1 = baseComponent.getByTestId('appointment-request-tab');
    const tab2 = baseComponent.getByTestId('email-me-tab');

    expect(screen.getByRole('tab', { selected: true })).toEqual(tab1);
    expect(screen.getByRole('tab', { selected: false })).toEqual(tab2);
  });
});
