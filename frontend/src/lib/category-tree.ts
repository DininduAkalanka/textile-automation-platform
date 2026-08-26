import { Category } from '@/types';

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

/**
 * The API returns a flat list (plan Session 2.2: "backend returns a flat
 * list not a nested tree" — depth is capped at 3, so building the tree
 * client-side from parentId is simpler than a recursive server shape).
 */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  function getChildren(parentId: string): CategoryNode[] {
    return categories
      .filter((c) => c.parentId === parentId)
      .map((child) => ({
        ...child,
        children: getChildren(child.id),
      }));
  }

  const topLevel = categories.filter((c) => !c.parentId);
  return topLevel.map((top) => ({
    ...top,
    children: getChildren(top.id),
  }));
}

/** Flattened, indented options for a <select> — top-level categories first,
 *  each followed recursively by its own sub-categories. */
export function categorySelectOptions(
  categories: Category[],
): Array<{ value: string; label: string }> {
  const result: Array<{ value: string; label: string }> = [];

  function traverse(nodes: CategoryNode[], depth: number) {
    for (const node of nodes) {
      const prefix = depth > 0 ? '—'.repeat(depth) + ' ' : '';
      result.push({ value: node.id, label: `${prefix}${node.name}` });
      if (node.children.length > 0) {
        traverse(node.children, depth + 1);
      }
    }
  }

  traverse(buildCategoryTree(categories), 0);
  return result;
}
