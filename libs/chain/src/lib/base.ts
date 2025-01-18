import type { Context, Command, Chain, GameContextKeys, GameContextState } from '@aklapper/types-game';

class BaseContext<T extends GameContextKeys | string> implements Context<T> {
  state: Map<T, GameContextState[T]>;
  constructor() {
    this.state = new Map<T, GameContextState[T]>();
  }
  put<K extends T>(key: K, value: GameContextState[K]): void {
    this.state.set(key, value);
  }
  get<K extends T>(key: K): GameContextState[K] | unknown {
    return this.state.get(key);
  }
  getString<K extends T>(key: K): string {
    return this.get(key) as string;
  }
  getNumber<K extends T>(key: K): number {
    return this.get(key) as number;
  }
}

export class ContextBuilder {
  static build<T extends GameContextKeys | string>(): Context<T> {
    return new BaseContext() as Context<T>;
  }
}

class BaseCommand implements Command {
  executor: <T extends GameContextKeys | string>(context: Context<T>) => boolean;
  constructor(executor: <T extends GameContextKeys | string>(context: Context<T>) => boolean) {
    this.executor = executor;
  }
  execute<T extends GameContextKeys | string>(context: Context<T>): boolean {
    return this.executor(context);
  }
}

export class CommandBuilder {
  static build(executor: (context: Context<GameContextKeys | string>) => boolean): Command {
    return new BaseCommand(executor) as Command;
  }
}

class BaseChain implements Chain {
  commands: Command[];
  continueOnError: boolean;
  constructor(commands: Command[], continueOnError: boolean) {
    this.commands = [...commands];
    this.continueOnError = continueOnError;
  }
  execute(context: Context<GameContextKeys | string>) {
    for (const command of this.commands) {
      const ans = command.execute(context);
      if (!this.continueOnError && !ans) {
        return ans;
      }
    }
    return true;
  }
  getCommands(): Command[] {
    return this.commands;
  }
}

export class ChainBuilder {
  static build(commands: Command[], continueOnError: boolean): Chain {
    return new BaseChain([...commands], continueOnError) as Chain;
  }
}
