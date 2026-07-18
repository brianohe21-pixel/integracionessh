export const META_FLOW_TEMPLATES: Record<string, Record<string, unknown>> = {
  lead_capture: {
    version: "7.3",
    screens: [
      {
        id: "LEAD_FORM",
        title: "Contact us",
        terminal: true,
        success: true,
        data: {},
        layout: {
          type: "SingleColumnLayout",
          children: [
            {
              type: "Form",
              name: "lead_form",
              children: [
                {
                  type: "TextInput",
                  name: "name",
                  label: "Name",
                  required: true,
                },
                {
                  type: "TextInput",
                  name: "email",
                  label: "Email",
                  "input-type": "email",
                  required: true,
                },
                {
                  type: "Footer",
                  label: "Submit",
                  "on-click-action": {
                    name: "complete",
                    payload: {
                      name: "${form.name}",
                      email: "${form.email}",
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  },
  feedback: {
    version: "7.3",
    screens: [
      {
        id: "FEEDBACK",
        title: "Rate us",
        terminal: true,
        success: true,
        data: {},
        layout: {
          type: "SingleColumnLayout",
          children: [
            {
              type: "Form",
              name: "feedback_form",
              children: [
                {
                  type: "RadioButtonsGroup",
                  name: "rating",
                  label: "How was your experience?",
                  required: true,
                  "data-source": [
                    { id: "5", title: "Excellent" },
                    { id: "4", title: "Good" },
                    { id: "3", title: "Average" },
                    { id: "2", title: "Poor" },
                    { id: "1", title: "Bad" },
                  ],
                },
                {
                  type: "Footer",
                  label: "Send",
                  "on-click-action": {
                    name: "complete",
                    payload: {
                      rating: "${form.rating}",
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  },
};
