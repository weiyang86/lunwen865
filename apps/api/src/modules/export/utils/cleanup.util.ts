import { access, unlink } from 'node:fs/promises';

export async function deleteFileIfExists(
  filePath: string | null | undefined,
): Promise<boolean> {
  if (!filePath) return false;
  try {
    await access(filePath);
  } catch {
    return false;
  }

  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}
