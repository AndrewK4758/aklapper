import type { GamePlayerValidation } from '@aklapper/types';

/**
 * This function retrieves game instance information from session storage.
 *
 * @returns {GamePlayerValidation | undefined} The game instance information if found in session storage, otherwise undefined.
 */

export const getGameInstanceInfo = (): GamePlayerValidation | undefined => {
  const fromSession = sessionStorage.getItem('__current_game__') as string;
  return fromSession ? (JSON.parse(fromSession) as GamePlayerValidation) : undefined;
};

export function addToToolipString(baseString: string, socialSite: string): string {
  return baseString.concat(socialSite);
}

// export const viteRefreshModule = (
//   <>
//     <script
//       type='module'
//       dangerouslySetInnerHTML={{
//         __html: `
//                   import RefreshRuntime from "/@react-refresh"
//                   RefreshRuntime.injectIntoGlobalHook(window)
//                   window.$RefreshReg$ = () => {}
//                   window.$RefreshSig$ = () => (type) => type
//                   window.__vite_plugin_react_preamble_installed__ = true
//                 `,
//       }}
//     />
//   </>
// );
