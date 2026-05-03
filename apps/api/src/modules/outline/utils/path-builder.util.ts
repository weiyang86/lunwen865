/**
 * 把 orderIndex 编码为 4 位数字字符串
 * 0 -> "0000", 12 -> "0012", 9999 -> "9999"
 */
export function encodeOrderSegment(orderIndex: number): string {
  if (!Number.isInteger(orderIndex) || orderIndex < 0 || orderIndex > 9999) {
    throw new Error(`orderIndex out of range: ${orderIndex}`);
  }
  return orderIndex.toString().padStart(4, '0');
}

/**
 * 由父 path + 当前 orderIndex 构造完整 path
 * parentPath="/0001/0002", orderIndex=3 -> "/0001/0002/0003"
 */
export function buildPath(
  parentPath: string | null,
  orderIndex: number,
): string {
  const seg = encodeOrderSegment(orderIndex);
  return parentPath ? `${parentPath}/${seg}` : `/${seg}`;
}
