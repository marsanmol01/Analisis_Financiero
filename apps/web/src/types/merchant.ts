export interface MerchantAlias {
  id: string;
  merchantId: string;
  pattern: string;
  createdAt: string;
}

export interface Merchant {
  id: string;
  userId: string;
  name: string;
  defaultCategoryId: string | null;
  createdAt: string;
  updatedAt: string;
  aliases: MerchantAlias[];
}

export interface MerchantInput {
  name: string;
  defaultCategoryId?: string;
}
