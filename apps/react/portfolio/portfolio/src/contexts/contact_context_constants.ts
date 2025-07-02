import { createContext } from 'react';

export type GoogleUserContextInfo = {
  email: string;
  name: string;
};

export interface GoogleUserContextProps {
  handleSetGoogleUser: (user: GoogleUserContextInfo) => void;
  GoogleUserContextValues: GoogleUserContextInfo;
}

const googleUserInit: GoogleUserContextProps = {
  handleSetGoogleUser: (_user: GoogleUserContextInfo) => ({}),
  GoogleUserContextValues: {
    email: '',
    name: '',
  },
};

export const GoogleUserContext = createContext<GoogleUserContextProps>(googleUserInit);
