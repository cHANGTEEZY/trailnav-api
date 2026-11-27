export const moderationTags = ["Moderation"];

export const moderationDocs = {
  getQueue: {
    tags: moderationTags,
    summary: "Fetch pending community trails and unresolved hazards",
    description:
      "Returns community_pending trails annotated with elevation spike diagnostics alongside active unresolved safety reports. Restricted to moderator and admin roles.",
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: "Moderation queue with elevation diagnostics" },
      401: { description: "Authentication required" },
      403: { description: "Moderator or admin role required" },
    },
  },
  reviewTrail: {
    tags: moderationTags,
    summary: "Approve, verify, edit geometry, or reject a community trail",
    description:
      "Moderators and admins can promote a submitted trail to verified or community_approved (optionally supplying cleaned LineStringZM geometry with automatic metric recalculation) or reject it.",
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: "Trail review recorded" },
      400: { description: "Validation failed" },
      403: { description: "Moderator or admin role required" },
      404: { description: "Trail not found" },
    },
  },
  triageHazard: {
    tags: moderationTags,
    summary: "Triage severity or resolve a reported hazard",
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: "Hazard updated" },
      400: { description: "Validation failed" },
      403: { description: "Moderator or admin role required" },
      404: { description: "Safety report not found" },
    },
  },
};
