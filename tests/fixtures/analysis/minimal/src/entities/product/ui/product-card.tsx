import type { Product } from "../model/product.types";
import { Button } from "../../../shared/ui/button";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article>
      <h3>{product.name}</h3>
      <p>{product.price}</p>
      <Button label="Add to cart" />
    </article>
  );
}
