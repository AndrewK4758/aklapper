import { ChainBuilder } from '@aklapper/chain';
import logAction from '../commands/action-log/log-actions-start';

export const logActionChain = ChainBuilder.build([logAction], false);
