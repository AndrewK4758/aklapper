type SocketID = string;
type PlayerID = string;

const socketPlayerMap = new Map<PlayerID, SocketID>();

export default socketPlayerMap;
