export const DEFAULT_SHOP_NAME = "Your store";

/** Keep the earlier automatic label compatible without renaming saved shop data. */
export function displayShopName(shopName: string): string {
  return shopName === "My store" ? DEFAULT_SHOP_NAME : shopName;
}
