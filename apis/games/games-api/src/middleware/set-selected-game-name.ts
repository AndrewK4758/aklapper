import type { Request } from 'express';
import type { GameNameString } from '@aklapper/types-game';

const useSetSelectedGameName = (req: Request): GameNameString => req.params['id'].replace(/-/g, ' ');

export default useSetSelectedGameName;
