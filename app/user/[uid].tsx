import React, { useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Spacing,
  Typography,
  Radius,
  Font,
  type ThemeColors,
} from "../../src/constants/colors";
import { useColors, ThemeOverrideContext } from "../../src/hooks/useColors";
import { Button, Skeleton, withErrorBoundary } from "../../src/components";
import { useAuthStore } from "../../src/store/authStore";
import { usePartnerStore } from "../../src/store/partnerStore";
import { useSocialStore } from "../../src/store/socialStore";
import { PublicProfile } from "../../src/types";

// Green-world text/border hierarchy (docs/redesign-all-tabs-progress.md):
// everything on the full-bleed primaryDark field is white, white@0.7, or
// white@0.55 — rgba so opacities never compound with layout opacity.
const WHITE_70 = "rgba(255, 255, 255, 0.7)";
const WHITE_55 = "rgba(255, 255, 255, 0.55)";
const WHITE_25 = "rgba(255, 255, 255, 0.25)";

// ─── Rep badge ────────────────────────────────────────────────────────────────

const repColor = (level: string, Colors: ThemeColors): string => {
  switch (level) {
    case "oak":
      return Colors.accentGold;
    case "tree":
      return Colors.primaryLight;
    case "sapling":
      return Colors.success;
    case "sprout":
      return Colors.warning;
    default:
      // Was Colors.textMuted — theme-dependent murky brown that vanishes on
      // the green field; the base level reads as quiet white instead.
      return WHITE_55;
  }
};

// ─── Main screen ──────────────────────────────────────────────────────────────

function PublicProfileScreenInner() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { partners, selectPartner } = usePartnerStore();
  const {
    profiles,
    loadMyFollows,
    loadProfile,
    followUser,
    unfollowUser,
    isFollowing,
  } = useSocialStore();

  const myUid = user?.id ?? "";
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const partner = partners.find((p) => p.oderId === uid);
  const hasFallbackProfile = Boolean(partner);
  const fallbackProfile: PublicProfile | undefined = partner
    ? {
        uid,
        name: partner.name,
        reputation: {
          score: partner.reputation.score,
          level: partner.reputation.level,
          referralCount: 0,
        },
        currentStreak: 0,
        totalSessions: partner.totalSessionsTogether,
        completedSessions: partner.totalSessionsTogether,
      }
    : undefined;
  const profile: PublicProfile | undefined = profiles[uid] ?? fallbackProfile;
  const isPartner = partners.some((p) => p.oderId === uid);
  const following_ = isFollowing(uid);

  useEffect(() => {
    if (!myUid || !uid) return;

    const init = async () => {
      setProfileLoading(true);
      setProfileError(false);
      try {
        await Promise.all([loadMyFollows(myUid), loadProfile(uid)]);
      } catch {
        if (!hasFallbackProfile) {
          setProfileError(true);
        }
      } finally {
        setProfileLoading(false);
      }
    };

    init();
  }, [myUid, uid, hasFallbackProfile, loadMyFollows, loadProfile]);

  const handleToggleFollow = async () => {
    setFollowLoading(true);
    try {
      if (following_) {
        await unfollowUser(myUid, uid);
      } else {
        await followUser(myUid, uid);
      }
    } finally {
      setFollowLoading(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (profileLoading && !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.backRow}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
        </View>
        <View style={styles.content}>
          <Skeleton
            width={80}
            height={80}
            radius={40}
            style={{ marginBottom: Spacing.md }}
          />
          <Skeleton
            width={150}
            height={24}
            radius={7}
            style={{ marginBottom: Spacing.sm }}
          />
          <Skeleton
            width={120}
            height={28}
            radius={14}
            style={{ marginBottom: Spacing.md }}
          />
          <Skeleton
            width="92.5%"
            height={11}
            radius={Radius.xl}
            style={{ marginBottom: Spacing.xl }}
          />
          <Skeleton
            width="92.5%"
            height={74}
            radius={Radius.xl}
            style={{ marginBottom: Spacing.xl }}
          />
          <Skeleton width="92.5%" height={50} radius={Radius.full} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (profileError || (!profileLoading && !profile)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.backRow}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not load profile.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const successRate =
    profile.totalSessions > 0
      ? Math.round((profile.completedSessions / profile.totalSessions) * 100)
      : 0;

  const progressWidth = Math.min(profile.reputation.score, 100);

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Back ────────────────────────────────────────────────────────── */}
      <View style={styles.backRow}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* ── Identity glass seat: avatar + name + rep badge + rep bar ──── */}
        <View style={styles.identityCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {profile.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          {/* Name + rep badge (reputation data/copy unchanged — only the
              surfaces are green-world; the level color stays on the dot
              and the bar fill) */}
          <Text style={styles.name}>{profile.name}</Text>
          <View style={styles.repBadge}>
            <View
              style={[
                styles.repDot,
                { backgroundColor: repColor(profile.reputation.level, Colors) },
              ]}
            />
            <Text style={styles.repBadgeText}>
              {profile.reputation.level.charAt(0).toUpperCase() +
                profile.reputation.level.slice(1)}{" "}
              · {profile.reputation.score}
            </Text>
          </View>

          {/* Rep progress bar — CloutCard geometry (11 tall, Radius.xl):
              glassMid track, level color as the fill */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressWidth}%`,
                  backgroundColor: repColor(profile.reputation.level, Colors),
                },
              ]}
            />
          </View>
        </View>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.currentStreak}</Text>
            <Text style={styles.statLabel}>Current Streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.totalSessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{successRate}%</Text>
            <Text style={styles.statLabel}>Success</Text>
          </View>
        </View>

        <View style={styles.actionsZone}>
          {/* ── Follow / Unfollow button — shared Button pill (style/textStyle
              overrides only, mirroring the dashboard CTA treatment) ──────── */}
          <Button
            title={following_ ? "Following" : "Follow"}
            onPress={handleToggleFollow}
            loading={followLoading}
            size="large"
            variant={following_ ? "outline" : "primary"}
            style={following_ ? styles.followingBtn : styles.followBtn}
            textStyle={following_ ? styles.followingBtnText : undefined}
          />

          {/* ── Start Session (partners only) ─────────────────────────────── */}
          {isPartner && (
            <Pressable
              style={styles.sessionBtn}
              onPress={() => {
                selectPartner(uid);
                router.push("/session/select");
              }}
            >
              <Text style={styles.sessionBtnText}>Start Session Together</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const PublicProfileBody = withErrorBoundary(
  PublicProfileScreenInner,
  "user-profile",
);

// Green-world theme pin: user/[uid] is a ROOT-Stack screen, so it sits OUTSIDE
// the pinned (tabs)/session layout subtrees and must pin itself. The provider
// goes ABOVE the screen body — a provider rendered inside the component
// couldn't affect the component's own useColors() — so the whole screen (own
// styles + theme-driven children like Button/Skeleton) resolves to the dark
// palette and renders identically in both themes.
const PublicProfileScreen = () => (
  <ThemeOverrideContext.Provider value="dark">
    <PublicProfileBody />
  </ThemeOverrideContext.Provider>
);
export default PublicProfileScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

// Full-bleed GREEN brand screen (mirrors profile.tsx / index.tsx, v2 node
// 429:186): primaryDark field, no shared horizontal padding — each section
// owns its proportional width (~92.5%, centered).
const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.primaryDark,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    backRow: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    backText: {
      fontSize: Typography.bodyMedium,
      ...Font.medium,
      color: Colors.white,
    },
    content: {
      flex: 1,
      alignItems: "center",
      paddingTop: Spacing.lg,
    },
    // Identity = glass seat (glassLight, Radius.xl, borderless), like the
    // dashboard header / balance cards.
    identityCard: {
      width: "92.5%",
      alignItems: "center",
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
    },
    // Dark-glass circle with a white initial (the dashboard header-action
    // circle treatment) — replaces the theme-dependent primaryMuted ring.
    avatarCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: Colors.glassDark,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.md,
    },
    avatarInitial: {
      fontSize: Typography.headlineLarge,
      ...Font.bold,
      color: Colors.white,
    },
    name: {
      fontSize: Typography.headlineSmall,
      ...Font.heavy,
      color: Colors.white,
      letterSpacing: -0.3,
      marginBottom: Spacing.sm,
    },
    // Dark-glass pill; the level color lives on the dot, copy stays white.
    repBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: Radius.full,
      backgroundColor: Colors.glassDark,
      paddingHorizontal: Spacing.md,
      paddingVertical: 5,
      marginBottom: Spacing.md,
    },
    repDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    repBadgeText: {
      fontSize: Typography.labelLarge,
      ...Font.semibold,
      color: Colors.white,
    },
    // CloutCard geometry: 11 tall, Radius.xl, glassMid track (fill color is
    // the rep level color, applied inline).
    progressTrack: {
      width: "100%",
      height: 11,
      backgroundColor: Colors.glassMid,
      borderRadius: Radius.xl,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: Radius.xl,
    },
    // Stats = glass seat, borderless; white value / white@0.7 label hierarchy.
    statsRow: {
      flexDirection: "row",
      width: "92.5%",
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
      marginBottom: Spacing.xl,
      paddingVertical: Spacing.md,
    },
    statItem: {
      flex: 1,
      alignItems: "center",
      gap: 4,
    },
    statValue: {
      fontSize: Typography.titleLarge,
      ...Font.bold,
      color: Colors.white,
    },
    statLabel: {
      fontSize: Typography.labelSmall,
      ...Font.regular,
      color: WHITE_70,
      textAlign: "center",
    },
    statDivider: {
      width: 1,
      backgroundColor: WHITE_25,
    },
    actionsZone: {
      width: "92.5%",
      gap: Spacing.md,
    },
    // Button overrides (public style/textStyle props only): primary pill for
    // Follow; outline pill (white@0.55 border / white text) for Following —
    // the dashboard ctaButton / ctaButtonOutline treatment.
    followBtn: {
      borderRadius: Radius.full,
    },
    followingBtn: {
      borderRadius: Radius.full,
      borderColor: WHITE_55,
    },
    followingBtnText: {
      color: Colors.white,
    },
    // Secondary action = outline pill, matching the dashboard's secondary CTAs.
    sessionBtn: {
      width: "100%",
      paddingVertical: Spacing.md,
      borderRadius: Radius.full,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: WHITE_55,
      minHeight: 44,
    },
    sessionBtnText: {
      fontSize: Typography.titleSmall,
      ...Font.medium,
      color: Colors.white,
    },
    errorText: {
      fontSize: Typography.bodyMedium,
      ...Font.regular,
      color: WHITE_70,
    },
  });
