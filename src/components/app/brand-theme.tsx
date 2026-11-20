import { brandCssVars, type RestaurantBrand } from "@/lib/brand";

/**
 * Wraps children with the restaurant's brand applied as CSS custom properties
 * (overriding --primary/--ring/etc.) + the staff appearance (dark default, or
 * .theme-light for restaurants that prefer a light dashboard). Keeps the
 * design system consistent while letting each restaurant express its identity.
 */
export function BrandTheme({
  brand,
  children,
}: {
  brand?: RestaurantBrand;
  children: React.ReactNode;
}) {
  const vars = brandCssVars(brand);
  const className = brand?.appearance === "light" ? "theme-light" : "";
  return (
    <div className={className} style={vars}>
      {children}
    </div>
  );
}
