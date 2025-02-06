import { ChainBuilder } from '@aklapper/chain';
import logAction from '../commands/action-log/log-actions-start.js';

export const logActionChain = ChainBuilder.build([logAction], false);
