import type { GamePlayerValidation } from '@aklapper/types';
import createCache from '@emotion/cache';
import type { FormikProps } from 'formik';
import type { FocusEvent } from 'react';
import handleNewArtistBlur from '../services/actions/crud-actions/handle-validate-artist-on-blur.js';

/**
 * This function retrieves game instance information from session storage.
 *
 * @returns {GamePlayerValidation | undefined} The game instance information if found in session storage, otherwise undefined.
 */

export const getGameInstanceInfo = (): GamePlayerValidation | undefined => {
  if (typeof window !== 'undefined') {
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

export function handleBlur<T1>(
  e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  formik: FormikProps<T1>,
  stateSetter: (value: string) => void,
  params: string,
) {
  handleNewArtistBlur(e, formik, stateSetter, params);
}

export const handlelFocus = async <T,>(
  e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  formik: FormikProps<T>,
) => {
  await formik.setFieldTouched(e.target.name, false);
};

const isBrowser = typeof document !== 'undefined';

// On the client side, Create a meta tag at the top of the <head> and set it as insertionPoint.
// This assures that Material UI styles are loaded first.
// It allows developers to easily override Material UI styles with other styling solutions, like CSS modules.

export function createEmotionCache() {
  let insertionPoint;

  if (isBrowser) {
    const emotionInsertionPoint = document.querySelector('meta[name="emotion-insertion-point"]') as HTMLElement;
    insertionPoint = emotionInsertionPoint ?? undefined;
  }
  return createCache({ key: 'style-cache', insertionPoint: insertionPoint });
}
