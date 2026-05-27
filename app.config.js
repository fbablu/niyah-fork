/**
 * Dynamic Expo config — replaces app.json so project-specific identifiers
 * (Firebase project ID, Google OAuth client IDs) come from .env rather than
 * being hardcoded in source control.
 *
 * See .env.example for required environment variables.
 */

function env(name, fallback) {
  const value = process.env[name];
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(
    `Missing required env var: ${name}. Copy .env.example to .env and fill in values.`,
  );
}

// Apple privacy-manifest "collected data" entry — mirrors the App Store Connect
// privacy labels. Every type Niyah collects is linked to the account and none is
// used for tracking (no ad SDKs / data brokers).
function collectedType(
  type,
  purposes = ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
) {
  return {
    NSPrivacyCollectedDataType: type,
    NSPrivacyCollectedDataTypeLinked: true,
    NSPrivacyCollectedDataTypeTracking: false,
    NSPrivacyCollectedDataTypePurposes: purposes,
  };
}

const firebaseProjectId = env("EXPO_PUBLIC_FIREBASE_PROJECT_ID");
const googleIosClientId = env("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID");
const googleIosShortId = googleIosClientId.replace(
  /\.apps\.googleusercontent\.com$/,
  "",
);

module.exports = {
  expo: {
    name: "Niyah",
    slug: "niyah",
    owner: "niyah-app",
    version: "1.0.0",
    scheme: "niyah",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.niyah.app",
      buildNumber: "11",
      appleTeamId: "4R55F73KCP",
      googleServicesFile:
        process.env.GOOGLE_SERVICE_INFO_PLIST ||
        "./firebase/GoogleService-Info.plist",
      usesAppleSignIn: true,
      // Universal links: primary is niyah.live so branded URLs (email magic
      // links, share-to-app, future deep links) resolve into the app. The
      // *.firebaseapp.com entry stays as a fallback for the Firebase Auth
      // continuation URL used by sendSignInLinkToEmail until that flow is
      // migrated to a niyah.live action handler.
      associatedDomains: [
        "applinks:niyah.live",
        `applinks:${firebaseProjectId}.firebaseapp.com`,
      ],
      entitlements: {
        "com.apple.developer.family-controls": true,
        "com.apple.security.application-groups": ["group.com.niyah.app"],
        // Default production so TestFlight + App Store get production APNs.
        // Set EXPO_PUBLIC_APNS_ENV=development for sandbox-APNs dev-client
        // builds when testing pre-prod push payloads.
        "aps-environment":
          process.env.EXPO_PUBLIC_APNS_ENV === "development"
            ? "development"
            : "production",
      },
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ["remote-notification", "fetch"],
        NSSupportsLiveActivities: true,
        NSFamilyControlsUsageDescription:
          "Niyah needs Screen Time access to block distracting apps during your focus sessions.",
        NSContactsUsageDescription:
          "Niyah uses your contacts to invite friends to focus sessions.",
        NSCameraUsageDescription:
          "Niyah may use the camera to scan payment cards during deposit or verify identity for payouts.",
        NSMicrophoneUsageDescription:
          "Niyah does not record audio. This permission is required by included payment SDKs.",
        NSFaceIDUsageDescription:
          "Niyah may use Face ID to confirm sensitive transactions.",
        NSUserTrackingUsageDescription:
          "Niyah does not track you across other apps.",
        NSLocationWhenInUseUsageDescription:
          "Niyah does not collect location. This permission is referenced by included SDKs.",
      },
      // App privacy manifest → PrivacyInfo.xcprivacy on prebuild. Required-reason
      // API types + NSPrivacyTracking are re-declared (so they survive whether
      // Expo merges or replaces its defaults); NSPrivacyCollectedDataTypes mirrors
      // the 10 App Store Connect privacy labels (all linked, none for tracking).
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType:
              "NSPrivacyAccessedAPICategoryFileTimestamp",
            NSPrivacyAccessedAPITypeReasons: ["C617.1", "0A2A.1", "3B52.1"],
          },
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
            NSPrivacyAccessedAPITypeReasons: ["CA92.1", "1C8F.1", "C56D.1"],
          },
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
            NSPrivacyAccessedAPITypeReasons: ["E174.1", "85F4.1"],
          },
          {
            NSPrivacyAccessedAPIType:
              "NSPrivacyAccessedAPICategorySystemBootTime",
            NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
          },
        ],
        NSPrivacyCollectedDataTypes: [
          collectedType("NSPrivacyCollectedDataTypeName"),
          collectedType("NSPrivacyCollectedDataTypeEmailAddress"),
          collectedType("NSPrivacyCollectedDataTypePhoneNumber"),
          collectedType("NSPrivacyCollectedDataTypeOtherFinancialInfo"),
          collectedType("NSPrivacyCollectedDataTypeContacts"),
          collectedType("NSPrivacyCollectedDataTypeUserID"),
          collectedType("NSPrivacyCollectedDataTypeDeviceID"),
          collectedType("NSPrivacyCollectedDataTypeProductInteraction", [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
            "NSPrivacyCollectedDataTypePurposeAnalytics",
          ]),
          collectedType("NSPrivacyCollectedDataTypeCrashData"),
          collectedType("NSPrivacyCollectedDataTypePerformanceData"),
        ],
      },
    },
    android: {
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON || "./firebase/google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#1A1714",
      },
      package: "com.niyah.app",
      edgeToEdgeEnabled: true,
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: `${firebaseProjectId}.firebaseapp.com`,
              pathPrefix: "/",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#2D6A4F",
        },
      ],
      "expo-router",
      "react-native-bottom-tabs",
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: `com.googleusercontent.apps.${googleIosShortId}`,
        },
      ],
      "expo-apple-authentication",
      "expo-contacts",
      [
        "@stripe/stripe-react-native",
        {
          merchantIdentifier: "merchant.com.niyah.app",
          enableGooglePay: false,
        },
      ],
      "./plugins/withFollyCoroutinesFix",
      "./plugins/withFmtConstevalFix",
      "./plugins/withGoogleServicesPlist",
      "./plugins/withGoogleServicesJson",
      "./plugins/withFirebaseStaticFrameworks",
      "./plugins/withResourceBundleSigning",
      "@bacons/apple-targets",
      // Sentry config plugin: wires source-map upload into the Xcode +
      // Gradle build phases via sentry-cli. SENTRY_AUTH_TOKEN must be set
      // in the EAS build env (eas secret:create) and at build time locally.
      // organization + project come from the Sentry project URL.
      [
        "@sentry/react-native/expo",
        {
          url: "https://sentry.io/",
          organization: process.env.SENTRY_ORG ?? "niyah",
          project: process.env.SENTRY_PROJECT ?? "niyah-mobile",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    nativeModulesDir: "modules",
    extra: {
      router: {},
      eas: {
        projectId: "dea6379a-e2c1-4e15-8d7e-3dc25f03b59b",
      },
    },
  },
};
