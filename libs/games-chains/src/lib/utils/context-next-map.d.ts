export type NextCommand = string;
export type NextCommandMap = Map<string, NextCommand>;
export declare const gameCommandMap: Map<string, NextCommandMap>;
export declare const chutesAndLaddersNextCommandMap: Map<string, string>;
export declare const ticTacToeNextCommandMap: Map<string, string>;
export declare enum GameName {
    CHUTES_AND_LADDERS = "Chutes-&-Ladders",
    TIC_TAC_TOE = "Tic-Tac-Toe"
}
export declare enum CommandStrings {
    VERIFY_PLAYER = "verify-player",
    VERIFY_READY_TO_PLAY = "verify-ready-to-play",
    FLIP_WINNER_FLAG = "flip-winner-flag"
}
//# sourceMappingURL=context-next-map.d.ts.map