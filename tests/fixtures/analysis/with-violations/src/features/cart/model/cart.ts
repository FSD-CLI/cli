import type { Product } from "../../../entities/product/model/product.types";

export type CartItem = {
  product: Product;
  quantity: number;
};

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
}
