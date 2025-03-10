import { ChainBuilder } from '@aklapper/chain';
import outputContextResponse from '../commands/action-output/output-context-response.js';

export const outputContextResponseChain = ChainBuilder.build([outputContextResponse], false);
