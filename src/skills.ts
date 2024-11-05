import type { SkillGroup } from "@xmtp/message-kit";

export const skills: SkillGroup[] = [
  {
    name: "Earl",
    tag: "@earl",
    description: "Earl manages all for the event",
    skills: [
      {
        command: "/id",
        adminOnly: true,
        handler: undefined,
        triggers: ["/id"],
        description: "Get the group ID.",
        params: {},
      },
    ],
  },
];
