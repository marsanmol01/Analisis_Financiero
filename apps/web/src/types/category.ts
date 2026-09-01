export interface Category {
  id: string;
  userId: string | null;
  name: string;
  parentId: string | null;
  isSystem: boolean;
}

export interface CategoryInput {
  name: string;
  parentId?: string | null;
}
