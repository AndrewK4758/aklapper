import { type AspectRatios, type PersonGenerations, type SafetyFilterLevels } from '@aklapper/types-ai';
export interface ImagenConfig {
    projectId: string;
    location: string;
    endpoint: string;
    prompt: string;
    sampleCount?: number;
    seed?: number;
    aspectRatio?: AspectRatios;
    safetyFilterLevel?: SafetyFilterLevels;
    personGeneration?: PersonGenerations;
}
export declare const imagenConfig: ImagenConfig;
export declare const generateImageRequest: (config: ImagenConfig) => {
    endpoint: string;
    parameters: object | import("protobufjs").common.IValue | null | undefined;
    instances: (object | import("protobufjs").common.IValue | null | undefined)[];
};
//# sourceMappingURL=generate-image-content.d.ts.map