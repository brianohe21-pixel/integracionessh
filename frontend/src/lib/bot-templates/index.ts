import { healthTemplate } from "./health";
import { realEstateTemplate } from "./real-estate";
import { retailTemplate } from "./retail";
import { supportTemplate } from "./support";
import type { BotIndustryTemplate, BotIndustryTemplateId } from "./types";

export const BOT_INDUSTRY_TEMPLATES: BotIndustryTemplate[] = [
  healthTemplate,
  retailTemplate,
  realEstateTemplate,
  supportTemplate,
];

export function getBotTemplate(id: BotIndustryTemplateId): BotIndustryTemplate {
  const template = BOT_INDUSTRY_TEMPLATES.find((item) => item.id === id);
  if (!template) {
    throw new Error(`Unknown bot template: ${id}`);
  }
  return template;
}

export type { BotIndustryTemplate, BotIndustryTemplateId, BotTemplateLocale } from "./types";
