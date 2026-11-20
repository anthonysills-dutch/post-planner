# Post Planner

Write LinkedIn posts with AI help, queue them into weekly posting times, and see how they do. Your team shares a library of example posts to learn from.

Inspired by https://taplio.com

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Write posts with a live preview and a 3,000-character count, and keep them on a board by status.
- Ask AI to draft a post from an idea, rewrite the hook, shorten it or change its tone.
- Set weekly posting times and a goal, queue or schedule posts, and see them by day and on a month calendar.
- Share a library of example posts, search and sort it, save examples to private collections and remix them.
- Track posts per week against your goal, your streak, and each post's numbers.
- Send a read-only preview link of a post to anyone for feedback, and revoke it.

Left out: accounts and sign-in, which your Gateway handles; plans and billing; engagement and lead tools; carousels; images, polls and other post formats; company pages; automatic analytics import; the browser extension.

## Setup

- Install: `pnpm everyapp install <repository url>`, or from a checkout `pnpm install`.
- Run locally: `pnpm dev`. Test: `pnpm test` for unit tests; `node checks/<suite>.mjs` runs a suite against a packaged release.
- Deploy: `pnpm run deploy`.
- AI: the writing help uses the workspace's default chat model (`everyapp ai default`), which the Gateway asks for at install. When no model answers, the writing help is switched off and the rest works.
- No secrets or settings to set.

## Limitations

- Publishing to LinkedIn needs a `linkedin` OAuth provider on your Gateway, which the release can't declare: register it (`everyapp provider add` with an `oauth2-user` spec for api.linkedin.com, scopes `openid profile w_member_social`), uncomment the `linkedin` capability in `everyapp.config.ts` and redeploy. Until then due posts are marked Failed and can be rescheduled.
- Post numbers (impressions, reactions, comments, reposts) are entered by hand.
- Text posts only. Publishing with a real LinkedIn account was not part of local testing.
