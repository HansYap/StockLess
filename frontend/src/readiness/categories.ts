/** Display categories never change product identifiers or calculations. */
export const FOOD_CATEGORIES = ["Beverages", "Staples", "Snacks", "Fresh & dairy", "Cooking & canned", "Non-food", "Other / unknown"] as const;
export type FoodCategory = typeof FOOD_CATEGORIES[number];

// Specific phrases precede broad words. Latin terms match whole words.
const DICTIONARY: readonly [FoodCategory, string][] = [
  ["Non-food", "toothpaste|toothbrush|detergent|soap|shampoo|tissue|plastic bag|cleaner|diaper|battery|sabun|ubat gigi|berus gigi|beg plastik|lampin|pencuci|syampu|牙膏|牙刷|肥皂|洗衣|洗发|紙巾|纸巾|塑料袋|尿布|电池"],
  ["Beverages", "orange juice|milk tea|fruit juice|air mineral|teh susu|jus buah|咖啡|奶茶|果汁|汽水|矿泉水|礦泉水"],
  ["Snacks", "biscuit|biscuits|cookie|cookies|chips|crisps|cracker|crackers|chocolate|candy|snack|snacks|biskut|keropok|coklat|gula gula|饼干|餅乾|薯片|巧克力|糖果|零食"],
  ["Cooking & canned", "canned|sardine|sardines|sardin|sauce|sos|sambal|kicap|curry|kari|vinegar|cuka|spice|spices|seasoning|instant noodle|instant noodles|mi segera|mee segera|罐头|罐頭|酱油|醬油|醬|酱|咖喱|醋|调味|方便面|即食面"],
  ["Beverages", "coffee|tea|juice|water|soda|drink|drinks|beverage|beverages|kopi|teh|minuman|jus|milo|nescafe"],
  ["Staples", "rice|flour|sugar|salt|oil|pasta|cereal|bread|beras|tepung|gula|garam|minyak|roti|米|面粉|麵粉|白糖|食盐|食鹽|食用油|面包|麵包"],
  ["Fresh & dairy", "milk|yoghurt|yogurt|cheese|butter|egg|eggs|chicken|beef|fish|prawn|prawns|meat|fruit|vegetable|apple|banana|orange|tomato|potato|susu|telur|ayam|ikan|daging|sayur|buah|牛奶|酸奶|奶酪|黄油|雞蛋|鸡蛋|鸡肉|魚|鱼|牛肉|蔬菜|水果|苹果|蘋果|香蕉"],
];
const rules = DICTIONARY.map(([category, terms]) => [category, terms.split("|").map(term => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[\\s-]+");
  return new RegExp(/^[a-z ]+$/i.test(term) ? "(?:^|[^a-z])" + escaped + "(?:$|[^a-z])" : escaped, "iu");
})] as const);

export function foodCategory(name: string): FoodCategory {
  const value = name.normalize("NFKC").toLowerCase();
  return rules.find(([, patterns]) => patterns.some(pattern => pattern.test(value)))?.[0] ?? "Other / unknown";
}
