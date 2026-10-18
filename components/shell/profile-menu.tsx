import { SignInMenu } from "@/components/auth/sign-in-menu";
import { ProfilePanel } from "@/components/shell/profile-panel";
import { getCurrentUser } from "@/lib/session";
import { getUserSettings } from "@/lib/user-settings";

/** The avatar and its panel, or the sign-in button. Reads the session: render inside <Suspense>. */
export async function ProfileMenu({ host }: { host: string }) {
  const user = await getCurrentUser();
  if (!user) return <SignInMenu />;
  const settings = await getUserSettings(user.id);
  return (
    <ProfilePanel
      user={{ name: user.name, username: user.username, email: user.email, image: user.image }}
      settings={{ publicProfile: settings.publicProfile, globalBoard: settings.globalBoard }}
      host={host}
    />
  );
}
