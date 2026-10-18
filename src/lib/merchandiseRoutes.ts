/**
 * Detail pages (one order or product) belong to a single event, so switching
 * the event there must land on the matching list page instead.
 */
export function routeForEventSwitch(pathname: string): string {
  const match = /^\/merchandise\/(orders|products)\/[^/]+\/?$/.exec(pathname);
  return match ? `/merchandise/${match[1]}` : pathname;
}
