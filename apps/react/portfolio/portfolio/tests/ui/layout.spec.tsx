import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import '../../src/components/header/contact/toggle_menu_button.js';
import Layout from '../../src/components/layout/layout.js';
import { render, ROUTES, screen } from '../utils/render_react_rotuter.js';

describe('test layout header and contact links', () => {
  beforeEach(() => {
    render(<Layout />, { initialRoute: ROUTES.PORTFOLIO, path: ROUTES.PORTFOLIO });
  });

  afterEach(() => {
    vi.clearAllMocks();
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

    const gitHubIcon = await screen.findByTestId('github-icon', {}, { timeout: 2500 });

    //NEED TO FIGURE OUT WHY SPYON WINDOW NOT WORKING//

    expect(gitHubIcon).toBeInTheDocument();
  });
});
