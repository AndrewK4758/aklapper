import { DefaultEsmTransformOptions } from 'ts-jest';
declare const _default: {
    displayName: string;
    preset: string;
    testEnvironment: string;
    transform: {
        '^.+\\.[tj]s$': (string | DefaultEsmTransformOptions)[];
    };
    extensionsToTreatAsEsm: string[];
    moduleFileExtensions: string[];
    coverageDirectory: string;
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': string;
    };
};
export default _default;
//# sourceMappingURL=jest.config.d.ts.map