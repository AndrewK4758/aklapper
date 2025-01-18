import { AllGamesMap } from '@aklapper/all-games-map';

export const allGamesMap = new AllGamesMap();

const useAllGamesMap = (): AllGamesMap => allGamesMap;

export default useAllGamesMap;
