import { ChainBuilder } from '../../../chain/index.ts';
import outputContextResponse from '../commands/action-output/output-context-response.js';

export const outputContextResponseChain = ChainBuilder.build([outputContextResponse], false);
