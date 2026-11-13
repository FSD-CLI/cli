// VIOLATION (INT-04 fixture): shared must never import from a feature.
// shared/ui -> features/cart is an upward import.
import { cartTotal } from "../../features/cart/model/cart";

export function Button({ label }: { label: string }) {
  void cartTotal;
  return <button type="button">{label}</button>;
}
