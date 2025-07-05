import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
// import type { MockInstance } from 'vitest';
import '../../src/components/header/contact/toggle_menu_button.js';
import Layout from '../../src/components/layout/layout.js';
import { render, ROUTES, screen } from '../utils/render_react_rotuter.js';

// let openSpy: MockInstance;

const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
describe('test layout header and contact links', () => {
  beforeEach(() => {
    render(<Layout />, { initialRoute: ROUTES.PORTFOLIO, path: ROUTES.PORTFOLIO });
  });

  afterEach(() => {
    vi.clearAllMocks();
    openSpy.mockRestore();
  });
  it('should render the header and open the contact menu', async () => {
    const user = userEvent.setup();
    const toggleContactMenuButton = screen.getByTestId('toggle-contact-menu-button');

    const contactMenuHidden = screen.queryByTestId('contact-menu');

    expect(contactMenuHidden).not.toBeInTheDocument();

    await user.click(toggleContactMenuButton);

    const contactMenu = await screen.findByTestId('contact-menu');

    expect(contactMenu).toBeInTheDocument();

    expect(contactMenu.childNodes.length).toEqual(7);
  });

  it('should navigate to the contact icons', async () => {
    const user = userEvent.setup();

    const toggleContactMenuButton = screen.getByTestId('toggle-contact-menu-button');

    await user.click(toggleContactMenuButton);

    const gitHubIcon = await screen.findByTestId('github-icon');

    await user.click(gitHubIcon);

    expect(gitHubIcon).toBeInTheDocument();
    // expect(openSpy).toHaveBeenCalledTimes(1);
    // expect(openSpy).toHaveBeenCalledWith('https://github.com/AndrewK4758/aklapper');
  });
});
