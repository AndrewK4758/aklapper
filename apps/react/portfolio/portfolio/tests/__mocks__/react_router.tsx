import { vi } from 'vitest';
import type { ReactChildrenProp } from '../types/types';

export const mockNavigate = vi.fn();
export const mockParams = vi.fn(() => ({}));
export const mockLocation = vi.fn(() => ({ pathname: '/' }));
export const mockLoaderData = vi.fn();
export const mockOutletContext = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useLocation: () => mockLocation,
    useLoaderData: () => mockLoaderData,
    useOutletContext: () => mockOutletContext,
    useNavigation: () => ({
      state: 'idle',
    }),
    Form: ({ children }: ReactChildrenProp) => <form>{children}</form>,
    Outlet: ({ children }: ReactChildrenProp) => <div data-testid='mock-outlet'>{children}</div>,
  };
});
