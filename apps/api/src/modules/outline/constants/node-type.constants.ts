export type OutlineNodeType =
  | 'CHAPTER'
  | 'SECTION'
  | 'SUBSECTION'
  | 'PARAGRAPH_HINT';

export const OUTLINE_NODE_TYPES = {
  CHAPTER: 'CHAPTER',
  SECTION: 'SECTION',
  SUBSECTION: 'SUBSECTION',
  PARAGRAPH_HINT: 'PARAGRAPH_HINT',
} as const satisfies Record<string, OutlineNodeType>;

export function nodeTypeByDepth(depth: number): OutlineNodeType {
  if (depth === 1) return OUTLINE_NODE_TYPES.CHAPTER;
  if (depth === 2) return OUTLINE_NODE_TYPES.SECTION;
  if (depth === 3) return OUTLINE_NODE_TYPES.SUBSECTION;
  if (depth === 4) return OUTLINE_NODE_TYPES.PARAGRAPH_HINT;
  throw new Error(`Unsupported depth: ${depth}`);
}

export function validateParentChildType(
  parent: OutlineNodeType | null,
  child: OutlineNodeType,
): boolean {
  if (!parent) return child === OUTLINE_NODE_TYPES.CHAPTER;
  if (parent === OUTLINE_NODE_TYPES.CHAPTER)
    return child === OUTLINE_NODE_TYPES.SECTION;
  if (parent === OUTLINE_NODE_TYPES.SECTION)
    return child === OUTLINE_NODE_TYPES.SUBSECTION;
  if (parent === OUTLINE_NODE_TYPES.SUBSECTION)
    return child === OUTLINE_NODE_TYPES.PARAGRAPH_HINT;
  return false;
}
