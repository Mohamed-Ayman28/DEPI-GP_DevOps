export function mediaUrl(path?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  let clean = path.replace(/^\/api\/uploads\//, '/uploads/');
  if (!clean.startsWith('/')) {
    clean = '/' + clean;
  }
  return clean;
}
