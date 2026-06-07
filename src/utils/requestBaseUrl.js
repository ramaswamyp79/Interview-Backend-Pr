export function getRequestBaseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}
