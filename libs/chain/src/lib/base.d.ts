import type { Context, Command, Chain, GameContextKeys } from '@aklapper/types-game';
export declare class ContextBuilder {
    static build<T extends GameContextKeys | string>(): Context<T>;
}
export declare class CommandBuilder {
    static build(executor: (context: Context<GameContextKeys | string>) => boolean): Command;
}
export declare class ChainBuilder {
    static build(commands: Command[], continueOnError: boolean): Chain;
}
//# sourceMappingURL=base.d.ts.map