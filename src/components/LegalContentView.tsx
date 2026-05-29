import React, { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import {
  Typography,
  Spacing,
  Font,
  type ThemeColors,
} from "../constants/colors";
import { useColors } from "../hooks/useColors";

// ─── Legal content (in-app mirror of niyah.live/legal/*) ─────────────────────

const TERMS_CONTENT = `Terms of Service

Last updated: May 27, 2026

1. Overview
Niyah is a productivity app and commitment-contract service. You stake your own money as a commitment device to support your focus goals. Session outcomes depend on your own actions, not chance, luck, or random events.

2. Eligibility
You must be at least 18 years old and a U.S. resident to use Niyah. By creating an account and accepting these terms, you affirm that you meet these requirements. You are responsible for maintaining the security of your account credentials.

3. How Sessions Work
You choose a session cadence (daily, weekly, or monthly) and stake an amount as a commitment to your own focus goal. If you complete the session, your stake is returned to you. If you surrender early, your stake is forfeited. In group sessions, each participant stakes individually and is accountable only for their own goal — stakes are never pooled, shared, or redistributed between participants. Completing or surrendering affects only your own stake.

4. Not Gambling
Niyah is not a gambling, gaming, lottery, or betting service. Stakes are commitment devices, and outcomes are determined entirely by your own actions during the session period — not by chance, by other participants, or by any random event. Stakes are never wagered against or pooled with other users.

5. Payments
Deposits, returned stakes, and withdrawals are processed through our payment provider, Stripe. Forfeited stakes are retained by Niyah; they are not paid to, split among, or settled between other participants. There are no peer-to-peer payments between users within Niyah.

6. User Conduct
You agree not to abuse the service, create fake accounts, manipulate sessions, or engage in fraudulent payment activity. Niyah reserves the right to suspend or terminate accounts that violate these terms.

7. Limitation of Liability
Niyah is provided "as is" without warranties of any kind. We are not liable for indirect, incidental, or consequential damages arising from your use of the service.

8. Changes to Terms
We may update these terms from time to time. When we do, you will be prompted to accept the new version before continuing to use the app.

9. Apple App Store
These terms are between you and Niyah only — not Apple. Apple has no responsibility for the app or its content and is not obligated to provide any maintenance or support for it. Apple makes no warranties regarding the app and, to the maximum extent permitted by law, is not responsible for any claims relating to the app, including product-liability, legal/regulatory, or consumer-protection claims. You agree to use the app in compliance with the Apple Media Services Terms and Usage Rules. Apple and its subsidiaries are third-party beneficiaries of these terms and may enforce them against you.

10. Contact
Questions about these terms? Contact us at support@niyah.live.`;

const PRIVACY_CONTENT = `Privacy Policy

Last updated: May 27, 2026

1. Information We Collect
We collect: account information (name, email, phone number), profile information, session data, social connections, payment-related identifiers (such as your Stripe customer and account IDs, and any payment handle you choose to add), and legal acceptance records (including your acceptance of these terms and your affirmation that you are at least 18 years old).

2. How We Use Your Data
Your data is used to operate the app: authenticate your identity, run focus sessions, manage your wallet and transactions, enable social features, and maintain legal and compliance records.

3. Service Providers
We use Firebase (Google Cloud) for authentication and data storage, and Stripe for payment processing. These providers process data on our behalf under their respective privacy policies.

4. Data Retention
Your data is retained as long as your account is active. You may request deletion of your account and associated data by contacting us.

5. Your Rights
You may access, correct, or request deletion of your personal data. Contact us at support@niyah.live.

6. Security
We use industry-standard measures to protect your data, including encryption in transit and at rest. However, no system is perfectly secure, and we cannot guarantee absolute security.

7. Changes to This Policy
We may update this policy from time to time. Changes will be reflected in the "Last updated" date above, and you will be prompted to review the new version.

8. Contact
Questions about privacy? Contact us at support@niyah.live.`;

// ─── Component ──────────────────────────────────────────────────────────────

interface LegalContentViewProps {
  /** Which section to display, or "both" (default) */
  section?: "terms" | "privacy" | "both";
}

export const LegalContentView: React.FC<LegalContentViewProps> = ({
  section = "both",
}) => {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
    >
      {(section === "terms" || section === "both") && (
        <View style={styles.section}>
          <Text style={styles.body}>{TERMS_CONTENT}</Text>
        </View>
      )}
      {section === "both" && <View style={styles.divider} />}
      {(section === "privacy" || section === "both") && (
        <View style={styles.section}>
          <Text style={styles.body}>{PRIVACY_CONTENT}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xxl,
    },
    section: {
      marginBottom: Spacing.lg,
    },
    body: {
      fontSize: Typography.bodySmall,
      color: Colors.textSecondary,
      lineHeight: Typography.bodySmall * 1.7,
      ...Font.regular,
    },
    divider: {
      height: 1,
      backgroundColor: Colors.border,
      marginVertical: Spacing.lg,
    },
  });
