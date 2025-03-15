import { AllGamesMap } from '@aklapper/models';

export const allGamesMap = new AllGamesMap();

const useAllGamesMap = (): AllGamesMap => allGamesMap;

export default useAllGamesMap;
