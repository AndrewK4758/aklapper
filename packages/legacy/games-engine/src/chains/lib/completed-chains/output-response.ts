import { ChainBuilder } from '../../../chain/index.ts';
import outputContextResponse from '../commands/action-output/output-context-response.ts';

export const outputContextResponseChain = ChainBuilder.build([outputContextResponse], false);
