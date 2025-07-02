import type { GamePlayerValidation } from '@aklapper/types';
import type { FormikProps } from 'formik';
import type { FocusEvent } from 'react';

/**
 * This function retrieves game instance information from session storage.
 *
 * @returns {GamePlayerValidation | undefined} The game instance information if found in session storage, otherwise undefined.
 */

export const getGameInstanceInfo = (): GamePlayerValidation | undefined => {
  if (clientCheck()) {
    const fromSession = sessionStorage.getItem('__current_game__') as string;
    return fromSession ? (JSON.parse(fromSession) as GamePlayerValidation) : undefined;
  } else return {};
};

export function addToToolipString(baseString: string, socialSite: string): string {
  return baseString.concat(socialSite);
}

export function clientCheck() {
  return typeof window !== 'undefined';
}

export const handlelFocus = async <T,>(
  e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  formik: FormikProps<T>,
) => {
  await formik.setFieldTouched(e.target.name, false);
};
