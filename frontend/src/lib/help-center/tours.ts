export type TourId = "bots" | "flows" | "templates";

export type TourStep = {
  element: string;
  titleKey: string;
  descriptionKey: string;
};

export type TourDefinition = {
  id: TourId;
  nameKey: string;
  descriptionKey: string;
  route: string;
  steps: TourStep[];
};

export const TOURS: TourDefinition[] = [
  {
    id: "bots",
    nameKey: "helpCenter.tours.bots.name",
    descriptionKey: "helpCenter.tours.bots.description",
    route: "/bots",
    steps: [
      {
        element: '[data-tour="bots-header"]',
        titleKey: "helpCenter.tours.bots.steps.header.title",
        descriptionKey: "helpCenter.tours.bots.steps.header.description",
      },
      {
        element: '[data-tour="bots-create"]',
        titleKey: "helpCenter.tours.bots.steps.create.title",
        descriptionKey: "helpCenter.tours.bots.steps.create.description",
      },
      {
        element: '[data-tour="bots-onboarding"]',
        titleKey: "helpCenter.tours.bots.steps.onboarding.title",
        descriptionKey: "helpCenter.tours.bots.steps.onboarding.description",
      },
      {
        element: '[data-tour="bots-grid"]',
        titleKey: "helpCenter.tours.bots.steps.grid.title",
        descriptionKey: "helpCenter.tours.bots.steps.grid.description",
      },
    ],
  },
  {
    id: "flows",
    nameKey: "helpCenter.tours.flows.name",
    descriptionKey: "helpCenter.tours.flows.description",
    route: "/flows",
    steps: [
      {
        element: '[data-tour="flows-header"]',
        titleKey: "helpCenter.tours.flows.steps.header.title",
        descriptionKey: "helpCenter.tours.flows.steps.header.description",
      },
      {
        element: '[data-tour="flows-create"]',
        titleKey: "helpCenter.tours.flows.steps.create.title",
        descriptionKey: "helpCenter.tours.flows.steps.create.description",
      },
      {
        element: '[data-tour="flows-table"]',
        titleKey: "helpCenter.tours.flows.steps.table.title",
        descriptionKey: "helpCenter.tours.flows.steps.table.description",
      },
      {
        element: '[data-tour="flows-toggle"]',
        titleKey: "helpCenter.tours.flows.steps.toggle.title",
        descriptionKey: "helpCenter.tours.flows.steps.toggle.description",
      },
    ],
  },
  {
    id: "templates",
    nameKey: "helpCenter.tours.templates.name",
    descriptionKey: "helpCenter.tours.templates.description",
    route: "/templates",
    steps: [
      {
        element: '[data-tour="templates-header"]',
        titleKey: "helpCenter.tours.templates.steps.header.title",
        descriptionKey: "helpCenter.tours.templates.steps.header.description",
      },
      {
        element: '[data-tour="templates-filter"]',
        titleKey: "helpCenter.tours.templates.steps.filter.title",
        descriptionKey: "helpCenter.tours.templates.steps.filter.description",
      },
      {
        element: '[data-tour="templates-create"]',
        titleKey: "helpCenter.tours.templates.steps.create.title",
        descriptionKey: "helpCenter.tours.templates.steps.create.description",
      },
      {
        element: '[data-tour="templates-table"]',
        titleKey: "helpCenter.tours.templates.steps.table.title",
        descriptionKey: "helpCenter.tours.templates.steps.table.description",
      },
    ],
  },
];

export function getTourById(id: TourId): TourDefinition | undefined {
  return TOURS.find((tour) => tour.id === id);
}
