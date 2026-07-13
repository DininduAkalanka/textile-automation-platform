import { Category } from '@/types';

export interface CategoryNode extends Category {
  children: Category[];
}

/**
 * The API returns a flat list (plan Session 2.2: "backend returns a flat
 * list not a nested tree" — depth is capped at 2, so building the tree
 * client-side from parentId is simpler than a recursive server shape for
 * only one possible level of nesting).
 */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const topLevel = categories.filter((c) => !c.parentId);
  return topLevel.map((top) => ({
    ...top,
    children: categories.filter((c) => c.parentId === top.id),
  }));
}

/** Flattened, indented options for a <select> — top-level categories first,
 *  each followed immediately by its own sub-categories. */
export function categorySelectOptions(
  categories: Category[],
): Array<{ value: string; label: string }> {
  return buildCategoryTree(categories).flatMap((top) => [
    { value: top.id, label: top.name },
    ...top.children.map((child) => ({
      value: child.id,
      label: `— ${child.name}`,
    })),
  ]);
}
