import { InstanceTimeMap, reaper } from '../data/instance-time-map/instance-time-map.js';

export const instanceMap = new InstanceTimeMap();

const useInstanceTimeMap = (): InstanceTimeMap => instanceMap;

reaper(instanceMap);

export default useInstanceTimeMap;
