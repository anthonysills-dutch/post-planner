import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "post-planner",
  name: "Post Planner",
  description:
    "Write, schedule and publish LinkedIn posts, keep a shared library of examples, and track how your posts do.",
  icon: "/icon.svg",
  access: "everyone",
  resources: {
    d1: ["DB"],
  },
  // Preview links (/s/<token>) are read by people outside the organization;
  // the page and the files it loads are the only public surface.
  public: [{ path: "/s/:token", methods: ["GET"] }],
  publicAssets: ["/assets/**", "/icon.svg"],
  ai: {
    chat: { why: "Drafts posts from an idea and rewrites the hook, length or tone." },
  },
  // Publishing to LinkedIn goes through a `linkedin` OAuth capability. The
  // Gateway refuses a capability it has no provider row for, so it is not
  // declared here: README.md ("Publishing to LinkedIn") says how to register
  // the provider and add this entry back:
  //
  // capabilities: {
  //   linkedin: {
  //     scopes: ["openid", "profile", "w_member_social"],
  //     why: "Publishes each member's scheduled posts to their own LinkedIn account.",
  //   },
  // },
  // features: {
  //   linkedin: { name: "LinkedIn publishing", why: "Scheduled posts go out to each member's own LinkedIn account.", capabilities: ["linkedin"] },
  // },
});
