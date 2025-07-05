import userEvent from '@testing-library/user-event';
import NavButton from '../../src/components/layout/navigation/nav_button';
import { mockNavigate } from '../__mocks__/react_router';
import { render, ROUTES, screen } from '../utils/render_react_rotuter';

describe('Test NavButton', () => {
  afterAll(() => {
    mockNavigate.mockClear();
  });
  it('should navigate to the correct route when clicked', async () => {
    const BUTTON_TEXT = 'CRUD';
    const routeName = 'crud';

    render(<NavButton buttonText={BUTTON_TEXT} name={routeName} />, {
      initialRoute: ROUTES.PORTFOLIO,
      path: ROUTES.PORTFOLIO,
    });

    const button = screen.getByRole('button', { name: BUTTON_TEXT });
    await userEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledWith(routeName);
  });
});
