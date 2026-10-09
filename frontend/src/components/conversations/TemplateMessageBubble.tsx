"use client";

import { getWhatsAppTemplateDisplay } from "@/lib/conversations/template-messages";
import type { Message } from "@/types";

export function TemplateMessageBubble({ message }: { message: Message }) {
  const display = getWhatsAppTemplateDisplay(message);
  if (!display) {
    return <p className="emoji-text whitespace-pre-wrap break-words">{message.content}</p>;
  }

  return (
    <div>
      {display.headerText ? (
        <p className="text-sm font-semibold leading-snug text-primary">{display.headerText}</p>
      ) : null}
      {display.bodyText ? (
        <p className="emoji-text mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-primary first:mt-0">
          {display.bodyText}
        </p>
      ) : null}
      {display.footerText ? (
        <p className="mt-1 text-xs leading-snug text-muted">{display.footerText}</p>
      ) : null}
      {display.buttons && display.buttons.length > 0 ? (
        <div className="-mx-3.5 mt-2 border-t border-subtle">
          {display.buttons.map((label, index) => (
            <div
              key={`${label}-${index}`}
              className="border-t border-subtle px-3 py-2 text-center text-xs font-medium text-accent first:border-t-0"
            >
              {label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
