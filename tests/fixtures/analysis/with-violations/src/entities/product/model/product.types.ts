// VIOLATION (INT-04 fixture): an entity must never import from a feature.
// entities/product -> features/auth is an upward import.
import { isAuthenticated } from "../../../features/auth/model/auth";

export type Product = {
  id: string;
  name: string;
  price: number;
};

export function isProductVisibleToGuests(product: Product): boolean {
  return product.price > 0 && !isAuthenticated(null);
}
