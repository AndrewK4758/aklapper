import { ChainBuilder } from '../../../chain/index.ts';
import logAction from '../commands/action-log/log-actions-start.ts';

export const logActionChain = ChainBuilder.build([logAction], false);
