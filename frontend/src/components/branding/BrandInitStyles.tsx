import {
  DEFAULT_PRIMARY_COLOR,
  normalizeBrandColor,
  renderBrandThemeCss,
} from "@/lib/brand-colors";

type BrandInitStylesProps = {
  primaryColor?: string | null;
};

export function BrandInitStyles({ primaryColor }: BrandInitStylesProps) {
  const color = normalizeBrandColor(primaryColor ?? DEFAULT_PRIMARY_COLOR);
  const css = renderBrandThemeCss(color);

  return <style id="brand-init">{css}</style>;
}
