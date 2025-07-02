import { type ReactElement, type ReactNode, useMemo, useState } from 'react';
import { GoogleUserContext, type GoogleUserContextInfo } from './contact_context_constants';

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
  const [user, setUser] = useState<GoogleUserContextInfo>({ email: '', name: '' });

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
