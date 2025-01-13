import { IGameBuilder, IBuiltGame, Command } from '@aklapper/types-game';
export declare class GameBuilder implements IGameBuilder {
    #private;
    constructor();
    setId(id: string): IGameBuilder;
    setName(name: string): IGameBuilder;
    setDescription(description: string): IGameBuilder;
    setImageURL(imageURL: string): IGameBuilder;
    setRule(order: number, title: string, value: string): IGameBuilder;
    setGameFunctionality(commands: Command[], continueOnError: boolean): IGameBuilder;
    setInstance<T>(instance: () => T): IGameBuilder;
    build(): IBuiltGame;
}
//# sourceMappingURL=game-builder.d.ts.map