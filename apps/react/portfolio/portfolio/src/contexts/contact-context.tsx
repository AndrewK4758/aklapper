import { createContext, type ReactElement, type ReactNode, useMemo, useState } from 'react';

export type GoogleUserContextInfo = {
  email: string;
  name: string;
};

export interface GoogleUserContextProps {
  handleSetGoogleUser: (user: GoogleUserContextInfo) => void;
  GoogleUserContextValues: GoogleUserContextInfo;
}

const googleUserInit: GoogleUserContextInfo = {
  email: '',
  name: '',
};

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const GoogleUserContext = createContext<GoogleUserContextProps>(null!);

interface GoogleContextProviderProps {
  children: ReactElement | ReactElement[] | ReactNode | ReactNode[];
}

/**
 * This component provides the Google User context to its children.
 * The context includes the user's email and name.
 *
 * @param {GoogleContextProviderProps} props - The props for the GoogleUserContextProvider component.
 * @param {ReactElement | ReactElement[] | ReactNode | ReactNode[]} props.children - The child components to which the context is provided.
 * @returns {ReactElement} The rendered GoogleUserContextProvider component.
 */

const GoogleUserContextProvider = ({ children }: GoogleContextProviderProps): ReactElement => {
  const [user, setUser] = useState<GoogleUserContextInfo>(googleUserInit);

  const handleSetGoogleUser = (user: GoogleUserContextInfo) => {
    setUser(user);
  };

  const GoogleUserContextValues = useMemo(() => user, [user]);
  return (
    <GoogleUserContext.Provider value={{ GoogleUserContextValues, handleSetGoogleUser }}>
      {children}
    </GoogleUserContext.Provider>
  );
};

export default GoogleUserContextProvider;
