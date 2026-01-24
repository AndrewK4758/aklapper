export default class Aria {
  public static isPushed(eventType: string): boolean {
    return eventType === 'mousedown';
  }

  public static toggleExpanded(current: boolean): boolean {
    return !current;
  }
}
