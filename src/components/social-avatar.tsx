import { initialsFor, type ProfileLite } from "@/hooks/use-social";

export function SocialAvatar({
  profile,
  size = 36,
  className = "",
}: {
  profile: Partial<ProfileLite> | null | undefined;
  size?: number;
  className?: string;
}) {
  const initials = initialsFor(profile);
  return (
    <div
      className={`shrink-0 rounded-full bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground font-bold overflow-hidden ${className}`}
      style={{ height: size, width: size, fontSize: Math.max(10, size / 3) }}
    >
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
