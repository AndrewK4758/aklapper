import type { ReactNode } from 'react';
import { vi } from 'vitest';

type ReactChildrenProp = { children: ReactNode };

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
    useLocation: () => ({ pathname: '/' }),
    useLoaderData: () => ({}),
    useOutletContext: () => ({}),
    Form: ({ children }: ReactChildrenProp) => <form>{children}</form>,
    Outlet: () => <div data-testid='outlet' />,
  };
});

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    postForm: vi.fn(),
    defaults: {
      headers: {
        common: {},
      },
    },
  },
}));

const mockSocket = {
  on: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  removeAllListeners: vi.fn(),
  connected: false,
};
vi.mock('socket.io-client', () => ({
  io: () => mockSocket,
}));

vi.mock('@react-oauth/google', () => ({
  useGoogleLogin: () => vi.fn(),
  GoogleOAuthProvider: ({ children }: ReactChildrenProp) => <div>{children}</div>,
}));

type SessionStorageMock = {
  [key: string]: string;
};

const sessionStorageMock = (() => {
  let store: SessionStorageMock = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});
