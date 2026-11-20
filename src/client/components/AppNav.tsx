import { Link } from "@tanstack/react-router";

const LINKS = [
  { to: "/", label: "Posts" },
  { to: "/queue", label: "Queue" },
  { to: "/calendar", label: "Calendar" },
  { to: "/library", label: "Library" },
  { to: "/stats", label: "Stats" },
  { to: "/settings", label: "Settings" },
] as const;

/** The app's pages, in the bar beside the way back to the Gateway. */
export function AppNav() {
  return (
    <nav className="flex items-center gap-1">
      {LINKS.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          activeOptions={{ exact: link.to === "/" }}
          className="shrink-0 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
