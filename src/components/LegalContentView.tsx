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

1. Agreement
These Terms of Service ("Terms") are the agreement between you and Niyah, Inc. ("Niyah," "we," "us"). By creating an account or using the Niyah app (the "Service"), you accept these Terms. This has the same legal effect as signing them. If you don't agree, please don't use Niyah.

2. Who Can Use Niyah
You must be at least 18 years old, a resident of the United States, and able to enter a binding contract. By accepting these Terms you confirm you meet these requirements and are responsible for keeping your account credentials secure. The Service isn't available where prohibited by law, and it's your responsibility to make sure you're allowed to use it where you are.

3. What Niyah Is
Niyah is a productivity and commitment-contract service. You stake your own money as a commitment device to support your personal focus goals. The outcome of every session depends entirely on your own actions during the session, not on chance, luck, other people, or any random event.

4. Not Gambling
Niyah is not a gambling, gaming, lottery, or betting service. Stakes are commitment devices, and outcomes are determined solely by your own effort. Stakes are never wagered against, pooled with, or paid to other users.

5. How Focus Sessions Work
You choose a session cadence (for example, daily, weekly, or monthly) and stake an amount on your focus goal. Complete the session and your stake is returned to you. Surrender early and your stake is forfeited. In group sessions, each participant stakes individually and is accountable only for their own goal. Stakes are never pooled, shared, or redistributed. What you do affects only your own stake.

6. Your Wallet, Deposits & Stakes
Your in-app wallet reflects your balance with Niyah. You deposit by card through our payment provider, Stripe. Money you deposit is yours; staking simply commits it to a focus session as described above. We don't lend money or pay interest on balances.

7. Completion Rewards & Promotions
From time to time we may, at our discretion, offer completion rewards (amounts on top of your returned stake) or promotional credits (such as a deposit-matching bonus). These are funded by Niyah. Rewards, promotional credits, and any balance beyond what you've deposited may require eligibility conditions before you can withdraw them, such as a minimum amount of account activity, a minimum account age, and identity verification. Promotions may be limited per person, changed or ended at any time, and revoked in cases of abuse or fraud. Nothing here guarantees any reward or promotion.

8. Withdrawals
You can withdraw your withdrawable balance to a bank account you link through Stripe. Because we're paying out real money, identity verification (KYC) is required first. Withdrawals are subject to minimum and maximum amounts, daily limits, and processing times, and may be delayed, held, or refused if we reasonably suspect fraud or to comply with law. Withdrawals are not available to residents of certain U.S. states (currently Florida and Hawaii); this list may change. Bank-linking and payouts are provided by Stripe and Plaid under their own terms.

9. Refunds & Deleting Your Account
Deposited funds are generally refundable to your original payment method. You can delete your account anytime from within the app. Deletion is permanent and can't be undone. When you delete, deposited funds are refunded to your original payment method; completion rewards and promotional credits may be forfeited if you haven't met the eligibility conditions above. We may keep limited records as required by law.

10. Forfeited Stakes
Forfeited stakes are retained by Niyah. They are never paid to, split among, or settled between other participants, and there are no peer-to-peer payments between users within Niyah.

11. Acceptable Use & Right to Refuse Service
You agree not to create fake or multiple accounts, manipulate sessions, rewards, or promotions, engage in fraudulent payment activity, use Niyah for money laundering or any unlawful purpose, or reverse engineer or interfere with the Service. Niyah reserves the right to refuse, suspend, or terminate service to anyone, at any time, for conduct we reasonably believe violates these Terms or creates legal or financial risk.

12. Suspension & Termination
We may suspend or terminate your access for any violation of these Terms or suspected fraud. Where lawful, we'll return your deposited funds; amounts subject to unmet eligibility conditions may be forfeited. Provisions that should reasonably survive termination (such as disclaimers, limitation of liability, and indemnity) will continue to apply.

13. Disclaimers, Limitation of Liability & Indemnity
THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE. TO THE MAXIMUM EXTENT PERMITTED BY LAW, NIYAH WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS OR DATA, ARISING FROM YOUR USE OF THE SERVICE. NIYAH'S TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF THE AMOUNT YOU DEPOSITED IN THE 12 MONTHS BEFORE THE CLAIM OR US $100. You agree to indemnify and hold Niyah harmless from claims, losses, and expenses (including reasonable legal fees) arising from your misuse of the Service or violation of these Terms or applicable law.

14. Changes to Niyah & These Terms
We may add, change, or remove features, and we may update these Terms. When we make material changes to these Terms, you will be prompted to review and accept the new version before continuing to use the app. Continuing to use Niyah after changes take effect means you accept them.

15. Apple App Store
These Terms are between you and Niyah only, not Apple. Apple has no responsibility for the app or its content and is not obligated to provide any maintenance or support for it. Apple makes no warranties regarding the app and, to the maximum extent permitted by law, is not responsible for any claims relating to the app, including product-liability, legal/regulatory, or consumer-protection claims. You agree to use the app in compliance with the Apple Media Services Terms and Usage Rules. Apple and its subsidiaries are third-party beneficiaries of these Terms and may enforce them against you.

16. Governing Law & Disputes
These Terms are governed by the laws of the State of Delaware, without regard to its conflict-of-laws rules. You and Niyah agree to first try to resolve any dispute informally by contacting us. Any dispute not resolved informally will be subject to the exclusive jurisdiction of the state and federal courts located in the State of Delaware. We may still seek injunctive relief in any appropriate jurisdiction.

17. Miscellaneous
If any part of these Terms is found unenforceable, the rest stays in effect. Our failure to enforce a right isn't a waiver of it. We aren't responsible for failures caused by events beyond our reasonable control. These Terms were drafted in U.S. English; if we provide a translation and there's a conflict, the English version controls.

18. Contact
Questions about these Terms? Contact us at support@niyah.live.`;

const PRIVACY_CONTENT = `Privacy Policy

Last updated: May 27, 2026

1. Intro
Niyah is a focus app with real financial stakes: you deposit your own money, stake it on a focus session, and get it back when you finish. Because money is involved, we take your data seriously and keep it to the minimum we need. This policy explains what we collect, why, and who helps us run the service. By using Niyah, you agree to this policy.

2. What We Collect
- Account info: your name, email, and phone number, so you can sign in and we can reach you.
- Profile: your display name and photo, shown on your devices and to friends you invite.
- Session activity: the focus sessions you create, your stakes, completions and surrenders, and streaks.
- Friends & partners: people you add or invite for group sessions, including contacts you choose to match.
- Payment identifiers: IDs from Stripe and Plaid (such as your Stripe customer and connected-account IDs) needed to process deposits, stakes, and withdrawals. Full card and bank numbers live with those providers, not with us.
- Identity-verification status: whether you've passed the identity check (KYC) required to withdraw, handled by Stripe.
- Legal records: that you accepted these terms, which version, and your affirmation that you're 18 or older.
- Device & diagnostics: app version, device type, and crash/error reports, so we can keep things working.

3. Screen Time Stays on Your Device
To help you limit distracting apps, Niyah uses Apple's Family Controls / Screen Time framework. That app-usage information is processed entirely on your device and is never sent to or collected by Niyah's servers.

4. How We Use Your Data
We use your information only to run and improve Niyah: to sign you in, run your focus sessions, manage your wallet and payments, connect you with friends, verify identity for withdrawals, prevent fraud, meet legal obligations, and provide support.

5. Money & Identity
We don't custody your money or move it between users. Deposits, refunds, and payouts run through Stripe; Plaid securely links your bank account for withdrawals. To pay out money, the law requires us to verify your identity; Stripe handles that check. These partners process your information under their own privacy policies.

6. Ads & Selling Data
Niyah has no advertising, no ad-network code, and no data brokers. We do not sell or rent your personal information to anyone.

7. Who We Share With
We share information only with the providers that help us run the service:
- Google Firebase (Google Cloud): sign-in, database, and infrastructure.
- Stripe: payments, identity verification, and bank payouts.
- Plaid: secure bank-account linking for withdrawals.
- Apple Push Notification service: notifications you turn on.
- Google reCAPTCHA Enterprise and Apple App Attest / DeviceCheck: confirming requests come from a genuine app install (abuse prevention).
We may also disclose information when required by law, to investigate or stop fraud or abuse, or to protect Niyah and its users. If Niyah is ever involved in a merger, acquisition, or sale of assets, user information may be part of that transfer.

8. How We Protect Your Information
We use industry-standard safeguards, including encryption in transit and at rest and strict access controls. No system is perfectly secure, so we can't promise absolute security, but we treat your data carefully.

9. Your Rights
You can view and update your information in the app, and you can delete your account and associated data at any time from Profile settings. You can also email us at support@niyah.live to access, correct, or delete your data. After deletion we remove or de-identify your data, except limited records we must keep for legal, tax, or fraud-prevention reasons.

10. For Minors
Niyah is only for people 18 and older. We don't knowingly collect information from anyone under 18, and the app isn't designed to attract them. If we learn we've collected such information, we delete it.

11. United States Only
Niyah is intended for use in the United States, and your information is processed in the United States.

12. Changes to This Policy
We may update this policy. When we do, we'll change the "Last updated" date above and prompt you to review the new version in the app. Please check back so you know the policy you're agreeing to.

13. Contact
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
