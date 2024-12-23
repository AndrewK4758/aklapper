import { ResponseType } from '../types/prompt-input-data-types';
export interface IPromptInputData {
    [key: string]: string | undefined | null | ResponseType;
    objective: string;
    responseFormat: ResponseType;
    instructions?: string | undefined;
    document?: string | null;
    textData?: string | undefined;
    examples?: string | undefined;
    constraints?: string | undefined;
    tone?: string | undefined;
    responseInstructions?: string | undefined;
}
//# sourceMappingURL=prompt-input-data.d.ts.map