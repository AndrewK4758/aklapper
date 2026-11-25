import type { TerminalReadlineAction } from '@aklapper/core';
import { createContext } from 'react';

export interface ZshTerminalHandle {
  readonly executeReadlineAction: (action: TerminalReadlineAction) => void;
  readonly containsTarget: (target: EventTarget | null) => boolean;
}

export interface TerminalReadlineRegistryValue {
  readonly paneId: string;
  readonly registerHandle: (paneId: string, handle: ZshTerminalHandle) => () => void;
}

export const TerminalReadlineRegistryContext = createContext<TerminalReadlineRegistryValue | null>(
  null,
);
