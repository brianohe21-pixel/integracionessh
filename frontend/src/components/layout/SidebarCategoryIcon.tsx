import { cn } from "@/lib/utils";

export type SidebarCategoryId =
  | "dashboard"
  | "operations"
  | "automation"
  | "outreach"
  | "insights"
  | "integrations"
  | "account"
  | "inbox"
  | "admin";

type CategoryStyle = {
  bgClass: string;
};

function getCategoryStyle(categoryId: string): CategoryStyle {
  switch (categoryId) {
    case "dashboard":
      return { bgClass: "bg-gradient-to-br from-[#0EA5E9] to-[#2563EB]" };
    case "operations":
      return { bgClass: "bg-[#4F46E5]" };
    case "automation":
      return { bgClass: "bg-[#F59E0B]" };
    case "outreach":
      return { bgClass: "bg-gradient-to-br from-[#F97316] to-[#EC4899]" };
    case "insights":
      return { bgClass: "bg-[#10B981]" };
    case "integrations":
      return { bgClass: "bg-[#8B5CF6]" };
    case "account":
      return { bgClass: "bg-[#3B82F6]" };
    case "inbox":
      return { bgClass: "bg-[#25D366]" };
    case "admin":
      return { bgClass: "bg-[#E11D48]" };
    default:
      return { bgClass: "bg-[#64748B]" };
  }
}

function CategoryGlyph({ categoryId, className }: { categoryId: string; className?: string }) {
  const shared = cn("h-3.5 w-3.5", className);

  switch (categoryId) {
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" className={shared} aria-hidden>
          <path
            fill="currentColor"
            d="M3 3h8v6H3V3zm10 0h8v10h-8V3zM3 11h5v10H3V11zm7 0h11v10H10V11z"
          />
        </svg>
      );
    case "operations":
      return (
        <svg viewBox="0 0 24 24" className={shared} aria-hidden>
          <path
            fill="currentColor"
            d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"
          />
        </svg>
      );
    case "automation":
      return (
        <svg viewBox="0 0 24 24" className={shared} aria-hidden>
          <path
            fill="currentColor"
            d="M13 2L4.5 13.5h5.5L11 22l8.5-11.5h-5.5L13 2z"
          />
        </svg>
      );
    case "outreach":
      return (
        <svg viewBox="0 0 24 24" className={shared} aria-hidden>
          <path
            fill="currentColor"
            d="M3 10v4h2l5 5V5L5 10H3zm13.5-2.5a1 1 0 0 1 0 1.4 7.5 7.5 0 0 1 0 8.2 1 1 0 1 1-1.4-1.4 5.5 5.5 0 0 0 0-5.4 1 1 0 0 1 1.4-1.4zm2.8-2.8a1 1 0 0 1 0 1.4 11.5 11.5 0 0 1 0 14.2 1 1 0 1 1-1.4-1.4 9.5 9.5 0 0 0 0-11.4 1 1 0 0 1 1.4-1.4z"
          />
        </svg>
      );
    case "insights":
      return (
        <svg viewBox="0 0 24 24" className={shared} aria-hidden>
          <path
            fill="currentColor"
            d="M3 20h18v2H1V1h2v19zM7 16h2v4H7v-4zm4-6h2v10h-2V10zm4-4h2v14h-2V6z"
          />
        </svg>
      );
    case "integrations":
      return (
        <svg viewBox="0 0 24 24" className={shared} aria-hidden>
          <path
            fill="currentColor"
            d="M7 14a5 5 0 0 0 4.9 4H14v2h-2.1A7 7 0 0 1 5 14H3v-2h2a7 7 0 0 1 6.9-6V4h2v2.1A5 5 0 0 0 14 10h2v2h-2.1A5 5 0 0 0 9 14H7zm5-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
          />
        </svg>
      );
    case "account":
      return (
        <svg viewBox="0 0 24 24" className={shared} aria-hidden>
          <path
            fill="currentColor"
            d="M12 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.42 0-8 2.24-8 5v3h16v-3c0-2.76-3.58-5-8-5z"
          />
        </svg>
      );
    case "inbox":
      return (
        <svg viewBox="0 0 24 24" className={shared} aria-hidden>
          <path
            fill="currentColor"
            d="M20 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4l3 3 3-3h6a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-2 12H6v-2h12v2z"
          />
        </svg>
      );
    case "admin":
      return (
        <svg viewBox="0 0 24 24" className={shared} aria-hidden>
          <path
            fill="currentColor"
            d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0H5z"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={shared} aria-hidden>
          <circle cx="12" cy="12" r="8" fill="currentColor" />
        </svg>
      );
  }
}

type SidebarCategoryIconProps = {
  categoryId: string;
  className?: string;
};

export function SidebarCategoryIcon({ categoryId, className }: SidebarCategoryIconProps) {
  const style = getCategoryStyle(categoryId);

  return (
    <span
      className={cn(
        "nav-category-icon flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-md text-white shadow-sm",
        style.bgClass,
        className
      )}
      aria-hidden
    >
      <CategoryGlyph categoryId={categoryId} />
    </span>
  );
}
