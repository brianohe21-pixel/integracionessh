import type { InteractionCategory } from "@/types";

export function interactionCategoryLabelKey(
  category: InteractionCategory | "uncategorized"
): string {
  if (category === "uncategorized") return "conversations.categoryUncategorized";
  const map: Record<InteractionCategory, string> = {
    sale: "conversations.categorySale",
    complaint: "conversations.categoryComplaint",
    callback: "conversations.categoryCallback",
    support: "conversations.categorySupport",
    inquiry: "conversations.categoryInquiry",
    billing: "conversations.categoryBilling",
    other: "conversations.categoryOther",
  };
  return map[category];
}

export const INTERACTION_CATEGORY_FILTER_OPTIONS: Array<
  InteractionCategory | "uncategorized"
> = [
  "sale",
  "complaint",
  "callback",
  "support",
  "inquiry",
  "billing",
  "other",
  "uncategorized",
];
