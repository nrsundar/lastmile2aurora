import AppLayoutCS from "@cloudscape-design/components/app-layout";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import SideNavigation from "@cloudscape-design/components/side-navigation";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "wouter";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();

  const isLanding = location === "/" || location === "/auth";

  return (
    <>
      <div id="top-nav">
        <TopNavigation
          identity={{
            title: "LastMile2Aurora",
            href: user ? "/dashboard" : "/",
            logo: { src: "", alt: "" },
          }}
          utilities={
            user
              ? [
                  { type: "button", text: "Dashboard", onClick: () => navigate("/dashboard") },
                  { type: "button", text: "Presentation", onClick: () => navigate("/presentation") },
                  {
                    type: "menu-dropdown",
                    text: user.email,
                    items: [{ id: "signout", text: "Sign out" }],
                    onItemClick: () => { logout(); navigate("/"); },
                  },
                ]
              : [
                  { type: "button", text: "Presentation", onClick: () => navigate("/presentation") },
                ]
          }
        />
      </div>
      {user && !isLanding ? (
        <AppLayoutCS
          navigation={
            <SideNavigation
              activeHref={location}
              onFollow={(e) => { e.preventDefault(); navigate(e.detail.href); }}
              header={{ text: "Migration Watchdog", href: "/dashboard" }}
              items={[
                { type: "link", text: "Live Dashboard", href: "/dashboard" },
                { type: "link", text: "Translate SQL", href: "/translate" },
                { type: "link", text: "Reports", href: "/report" },
                { type: "divider" },
                { type: "link", text: "Admin Dashboard", href: "/admin" },
                { type: "divider" },
                { type: "link", text: "Oracle Quirks: 15 handled", href: "/translate" },
              ]}
            />
          }
          content={children}
          toolsHide
        />
      ) : (
        <div>{children}</div>
      )}
    </>
  );
}
