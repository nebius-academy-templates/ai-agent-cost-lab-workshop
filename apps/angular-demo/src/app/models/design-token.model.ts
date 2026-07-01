/** Design-token domain models (surrounding design-system app). */

export type TokenCategory = 'color' | 'spacing' | 'typography' | 'shadow' | 'motion';

export interface DesignToken {
  id: string;
  name: string;
  category: TokenCategory;
  value: string;
  deprecated: boolean;
}

export interface TokenGroup {
  category: TokenCategory;
  tokens: DesignToken[];
}

export function groupTokens(tokens: DesignToken[]): TokenGroup[] {
  const byCategory = new Map<TokenCategory, DesignToken[]>();
  for (const token of tokens) {
    const list = byCategory.get(token.category) ?? [];
    list.push(token);
    byCategory.set(token.category, list);
  }
  return [...byCategory.entries()].map(([category, list]) => ({ category, tokens: list }));
}

export function activeTokens(tokens: DesignToken[]): DesignToken[] {
  return tokens.filter((t) => !t.deprecated);
}
