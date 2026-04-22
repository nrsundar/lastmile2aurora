import AppLayoutCS from "@cloudscape-design/components/app-layout";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import SideNavigation from "@cloudscape-design/components/side-navigation";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "wouter";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();

  return (
    <>
      <TopNavigation
        identity={{ title: "LastMile2Aurora", href: "/", logo: { src: "", alt: "LM2A" } }}
        utilities={
          user
            ? [{ type: "menu-dropdown", text: user.email, items: [{ id: "signout", text: "Sign out" }], onItemClick: () => logout() }]
            : [{ type: "button", text: "Sign in", onClick: () => navigate("/auth") }]
        }
      />
      <AppLayoutCS
        navigation={
          <SideNavigation
            activeHref={location}
            onFollow={(e) => { e.preventDefault(); navigate(e.detail.href); }}
            header={{ text: "Migration Watchdog", href: "/" }}
            items={[
              { type: "link", text: "Live Dashboard", href: "/" },
              { type: "link", text: "Translate SQL", href: "/translate" },
              { type: "link", text: "Reports", href: "/report" },
            ]}
          />
        }
        content={children}
        toolsHide
      />
    </>
  );
}
