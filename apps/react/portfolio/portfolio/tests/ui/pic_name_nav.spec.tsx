import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { ABOUT_ME_TITLE } from '../../src/components/home/static/intro-static';
import AppNavBar from '../../src/components/layout/navigation/app_nav_bar';
import PicNameAndNav from '../../src/components/layout/pic_name_nav';
import { mockNavigate } from '../__mocks__/react_router';
import { render, ROUTES, screen } from '../utils/render_react_rotuter';

describe('test pic name and navbar element', () => {
  beforeEach(() => {
    render(<PicNameAndNav subheader={<AppNavBar />} />, { initialRoute: ROUTES.PORTFOLIO, path: ROUTES.PORTFOLIO });
  });

  afterEach(mockNavigate.mockClear());
  it('should render the introduction title and image', () => {
    const introTitle = screen.getAllByRole('heading', { level: 1 })[0].textContent;
    const introImage = screen.getByTestId('card-media-resume-image');

    expect(introTitle).toEqual(ABOUT_ME_TITLE);
    expect(introImage).toBeInTheDocument();
  });

  it('should render the app navbar and link to portfolio', async () => {
    const home = screen.getByTestId('home-nav-button');

    // const games = screen.getByTestId('games-nav-button');
    // const genAi = screen.getByTestId('gen-ai-nav-button');

    await userEvent.click(home);

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.PORTFOLIO);

    // const crud = screen.getByTestId('crud-nav-button');
  });

  it('should render the app navbar and link to crud', async () => {
    const crud = screen.getByTestId('crud-nav-button');

    await userEvent.click(crud);

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CRUD);
  });

  it('should render the app navbar and link to games', async () => {
    const games = screen.getByTestId('games-nav-button');

    await userEvent.click(games);

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.GAMES);
  });

  it('should render the app navbar and link to crud', async () => {
    const genAi = screen.getByTestId('gen-ai-nav-button');

    await userEvent.click(genAi);

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.GEN_AI);
  });
});
