export function windowsToPosixPath(path: string): string {
  const drive = path.match(/^([A-Za-z]):\\(.*)$/);
  if (!drive) return path.replaceAll("\\", "/");
  return `/${drive[1].toLowerCase()}/${drive[2].replaceAll("\\", "/")}`;
}

export function posixToWindowsPath(path: string): string {
  const drive = path.match(/^\/([A-Za-z])\/(.*)$/);
  if (!drive) return path.replaceAll("/", "\\");
  return `${drive[1].toUpperCase()}:\\${drive[2].replaceAll("/", "\\")}`;
}
