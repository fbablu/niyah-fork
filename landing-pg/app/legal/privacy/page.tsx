import type { ReactNode } from "react";

export const metadata = {
  title: "Privacy Policy — Niyah",
  description: "How Niyah collects, uses, and protects your information.",
};

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 mb-3 text-xl font-semibold">{children}</h2>;
}
function P({ children }: { children: ReactNode }) {
  return <p className="mb-4 leading-relaxed">{children}</p>;
}
function Mail() {
  return (
    <a
      className="text-primary underline underline-offset-2"
      href="mailto:support@niyah.live"
    >
      support@niyah.live
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        Last updated: May 27, 2026
      </p>

      <div className="my-6 rounded-xl border border-border bg-muted/50 p-5">
        <h2 className="mb-3 text-lg font-semibold">Summary in Plain Words</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            We collect only what we need to run your account, your focus
            sessions, and to move your money safely.
          </li>
          <li>
            Real money is handled by our partners — <strong>Stripe</strong>{" "}
            (payments and identity checks) and <strong>Plaid</strong> (linking
            your bank so you can withdraw). We never store your full card or
            bank-account numbers.
          </li>
          <li>
            Your <strong>Screen Time / app-usage data stays on your device.</strong>{" "}
            We never see it or send it to our servers.
          </li>
          <li>
            We don’t run ads, and we <strong>never sell your data.</strong>
          </li>
          <li>
            Niyah is for adults (<strong>18+</strong>) in the{" "}
            <strong>United States</strong> only.
          </li>
          <li>
            You can <strong>delete your account and data anytime</strong>, right
            in the app.
          </li>
        </ul>
      </div>

      <H2>Intro</H2>
      <P>
        Niyah is a focus app with real financial stakes: you deposit your own
        money, stake it on a focus session, and get it back when you finish.
        Because money is involved, we take your data seriously and keep it to the
        minimum we need. This policy explains what we collect, why, and who helps
        us run the service. By using Niyah, you agree to this policy.
      </P>

      <H2>What We Collect</H2>
      <ul className="mb-4 list-disc space-y-2 pl-5">
        <li>
          <strong>Account info</strong> — your name, email, and phone number, so
          you can sign in and we can reach you.
        </li>
        <li>
          <strong>Profile</strong> — your display name and photo, so they show up
          on your devices and to friends you invite.
        </li>
        <li>
          <strong>Session activity</strong> — the focus sessions you create, your
          stakes, completions and surrenders, and streaks — the data needed to
          run the app.
        </li>
        <li>
          <strong>Friends &amp; partners</strong> — people you add or invite for
          group sessions, including contacts you choose to match, so we can
          connect you.
        </li>
        <li>
          <strong>Payment identifiers</strong> — IDs from Stripe and Plaid (like
          your Stripe customer and connected-account IDs) needed to process
          deposits, stakes, and withdrawals. Full card and bank numbers live with
          those providers, not with us.
        </li>
        <li>
          <strong>Identity-verification status</strong> — whether you’ve passed
          the identity check (KYC) required to withdraw, handled by Stripe.
        </li>
        <li>
          <strong>Legal records</strong> — that you accepted these terms, which
          version, and your affirmation that you’re 18 or older.
        </li>
        <li>
          <strong>Device &amp; diagnostics</strong> — app version, device type,
          and crash/error reports, so we can keep things working.
        </li>
      </ul>
      <P>
        <strong>Screen Time stays on your device.</strong> To help you limit
        distracting apps, Niyah uses Apple’s Family Controls / Screen Time
        framework. That app-usage information is processed entirely on your device
        and is never sent to or collected by Niyah’s servers.
      </P>

      <H2>How We Use It</H2>
      <P>
        We use your information only to run and improve Niyah — to sign you in,
        run your focus sessions, manage your wallet and payments, connect you with
        friends, verify identity for withdrawals, prevent fraud, meet legal
        obligations, and provide support.
      </P>

      <H2>Money &amp; Identity</H2>
      <P>
        We don’t custody your money or move it between users. Deposits, refunds,
        and payouts run through <strong>Stripe</strong>; <strong>Plaid</strong>{" "}
        securely links your bank account for withdrawals. To pay out money, the
        law requires us to verify your identity — Stripe handles that check. These
        partners process your information under their own privacy policies.
      </P>

      <H2>Ads &amp; Selling Data</H2>
      <P>
        Niyah has no advertising, no ad-network code, and no data brokers. We do
        not sell or rent your personal information to anyone.
      </P>

      <H2>Who We Share With</H2>
      <P>
        We share information only with the providers that help us run the service:
      </P>
      <ul className="mb-4 list-disc space-y-2 pl-5">
        <li>
          <strong>Google Firebase (Google Cloud)</strong> — sign-in, database, and
          infrastructure.
        </li>
        <li>
          <strong>Stripe</strong> — payments, identity verification, and bank
          payouts.
        </li>
        <li>
          <strong>Plaid</strong> — secure bank-account linking for withdrawals.
        </li>
        <li>
          <strong>Apple Push Notification service</strong> — notifications you turn
          on.
        </li>
        <li>
          <strong>Google reCAPTCHA Enterprise and Apple App Attest / DeviceCheck</strong>{" "}
          — confirming requests come from a genuine app install (abuse
          prevention).
        </li>
      </ul>
      <P>
        We may also disclose information when required by law (such as a subpoena
        or court order), to investigate or stop fraud or abuse, or to protect
        Niyah and its users. If Niyah is ever involved in a merger, acquisition, or
        sale of assets, user information may be part of that transfer.
      </P>

      <H2>How We Protect Your Information</H2>
      <P>
        We use industry-standard safeguards, including encryption in transit and at
        rest and strict access controls on our systems. No system is perfectly
        secure, so we can’t promise absolute security — but we treat your data
        carefully.
      </P>

      <H2>Your Rights</H2>
      <P>
        You can view and update your information in the app, and you can delete your
        account and associated data at any time from Profile settings. You can also
        email us at <Mail /> to access, correct, or delete your data. After deletion
        we remove or de-identify your data, except limited records we must keep for
        legal, tax, or fraud-prevention reasons.
      </P>

      <H2>For Minors</H2>
      <P>
        Niyah is only for people 18 and older. We don’t knowingly collect
        information from anyone under 18, and the app isn’t designed to attract
        them. If we learn we’ve collected such information, we delete it.
      </P>

      <H2>United States Only</H2>
      <P>
        Niyah is intended for use in the United States, and your information is
        processed in the United States.
      </P>

      <H2>Future Changes</H2>
      <P>
        We may update this policy. When we do, we’ll change the “Last updated” date
        above and prompt you to review the new version in the app. Please check back
        so you know the policy you’re agreeing to.
      </P>

      <H2>Contact</H2>
      <P>
        Questions about privacy? Email us at <Mail />.
      </P>
    </article>
  );
}
