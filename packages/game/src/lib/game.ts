import { Avatar, generateRandomNumber, Player } from '@aklapper/games-components';
import { type AllGameTypes, Color, type Email, type IGame, SpaceType } from '@aklapper/types';

export class Game implements IGame {
  game: AllGameTypes;
  playersArray: Player[];
  playerInTurn!: Player;
  readyToPlay: boolean;
  haveWinner: boolean;
  currentPlayer: number;
  constructor(instance: AllGameTypes) {
    this.game = instance;
    this.playersArray = [];
    this.readyToPlay = false;
    this.haveWinner = false;
    this.currentPlayer = 0;
  }

  get instance(): AllGameTypes {
    return this.game;
  }

  register(playerName: string, id: string, avatarName: string, color: Color, email: Email = 'test@test.com') {
    const player = new Player(playerName, id, email);
    const avatar = new Avatar(avatarName, color);
    player.avatar = avatar;
    this.generatePlayerOrder(player);
  }

  generatePlayerOrder(player: Player) {
    const unshiftOrPush = generateRandomNumber(2);
    if (unshiftOrPush === 1) this.playersArray.push(player);
    if (unshiftOrPush === 2) this.playersArray.unshift(player);
  }

  verifyReadyToPlay(min: number, max: number) {
    return (this.readyToPlay = this.playersArray.length >= min && this.playersArray.length <= max ? true : false);
  }

  rotatePlayers() {
    this.currentPlayer++;
    if (this.currentPlayer === this.playersArray.length) this.currentPlayer = 0;
    this.playerInTurn = this.playersArray[this.currentPlayer];
  }

  wonGame(locationType: SpaceType) {
    return locationType === SpaceType.FINISH;
  }
}

export default Game;
