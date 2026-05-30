import type { ReactNode } from "react";

export const metadata = {
  title: "Terms of Service - Niyah",
  description:
    "The agreement between you and Niyah, Inc. for using the Niyah app.",
};

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 mb-3 text-xl font-semibold">{children}</h2>;
}
function P({ children }: { children: ReactNode }) {
  return <p className="mb-4 leading-relaxed">{children}</p>;
}
function Caps({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
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

export default function TermsPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        Last updated: May 27, 2026
      </p>

      <P>
        These Terms of Service (“Terms”) are the agreement between you and Niyah,
        Inc. (“Niyah,” “we,” “us”). By creating an account or using the Niyah app
        (the “Service”), you accept these Terms. This has the same legal effect as
        signing them. If you don’t agree, please don’t use Niyah.
      </P>

      <div className="my-6 rounded-xl border border-border bg-muted/50 p-5">
        <h2 className="mb-3 text-lg font-semibold">Summary in Plain Words</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Niyah is a <strong>commitment contract</strong>, not gambling: you
            stake your own money to back your focus goals.
          </li>
          <li>
            <strong>Finish your session, your stake comes back. Quit early, you
            forfeit it</strong> to Niyah, never to another user.
          </li>
          <li>
            Group sessions are <strong>individual</strong>: everyone stakes their
            own money and is on the hook only for their own goal. Nothing is
            pooled.
          </li>
          <li>
            You must be <strong>18+</strong> and in the{" "}
            <strong>United States</strong>. Withdrawals require an identity check
            and aren’t available in a few states.
          </li>
          <li>
            We may offer rewards or promotions on top of your stake; those are
            funded by us and may need some account activity before you can
            withdraw them.
          </li>
        </ul>
      </div>

      <H2>Who Can Use Niyah</H2>
      <P>
        You must be at least 18 years old, a resident of the United States, and
        able to enter a binding contract. By accepting these Terms you confirm you
        meet these requirements. The Service isn’t available where prohibited by
        law, and it’s your responsibility to make sure you’re allowed to use it
        where you are.
      </P>

      <H2>What Niyah Is</H2>
      <P>
        Niyah is a productivity and commitment-contract service. You stake your own
        money as a commitment device to support your personal focus goals. The
        outcome of every session depends entirely on your own actions during the
        session, not on chance, luck, other people, or any random event.
      </P>

      <H2>Not Gambling</H2>
      <P>
        Niyah is not a gambling, gaming, lottery, or betting service. Stakes are
        commitment devices, and outcomes are determined solely by your own effort.
        Stakes are never wagered against, pooled with, or paid to other users.
      </P>

      <H2>How Focus Sessions Work</H2>
      <P>
        You choose a session cadence (for example, daily, weekly, or monthly) and
        stake an amount on your focus goal. Complete the session and your stake is
        returned to you. Surrender early and your stake is forfeited. In group
        sessions, each participant stakes individually and is accountable only for
        their own goal. Stakes are never pooled, shared, or redistributed. What
        you do affects only your own stake.
      </P>

      <H2>Your Wallet, Deposits &amp; Stakes</H2>
      <P>
        Your in-app wallet reflects your balance with Niyah. You deposit by card
        through our payment provider, Stripe. Money you deposit is yours; staking
        simply commits it to a focus session as described above. We don’t lend
        money or pay interest on balances.
      </P>

      <H2>Completion Rewards &amp; Promotions</H2>
      <P>
        From time to time we may, at our discretion, offer completion rewards
        (amounts on top of your returned stake) or promotional credits (such as a
        deposit-matching bonus). These are funded by Niyah. Rewards, promotional
        credits, and any balance beyond what you’ve deposited may require
        eligibility conditions before you can withdraw them, such as a minimum
        amount of account activity, a minimum account age, and identity
        verification. Promotions may be limited per person, changed or ended at any time,
        and revoked in cases of abuse or fraud. Nothing here guarantees any reward
        or promotion.
      </P>

      <H2>Withdrawals</H2>
      <P>
        You can withdraw your withdrawable balance to a bank account you link
        through Stripe. Because we’re paying out real money, identity verification
        (KYC) is required first. Withdrawals are subject to minimum and maximum
        amounts, daily limits, and processing times, and may be delayed, held, or
        refused if we reasonably suspect fraud or to comply with law. Withdrawals
        are not available to residents of certain U.S. states (currently Florida
        and Hawaii); this list may change. Bank-linking and payouts are provided by
        Stripe and Plaid under their own terms.
      </P>

      <H2>Refunds &amp; Deleting Your Account</H2>
      <P>
        Deposited funds are generally refundable to your original payment method.
        You can delete your account anytime from within the app.{" "}
        <strong>Deletion is permanent and can’t be undone.</strong> When you delete,
        deposited funds are refunded to your original payment method; completion
        rewards and promotional credits may be forfeited if you haven’t met the
        eligibility conditions above. We may keep limited records as required by
        law.
      </P>

      <H2>Forfeited Stakes</H2>
      <P>
        Forfeited stakes are retained by Niyah. They are never paid to, split among,
        or settled between other participants, and there are no peer-to-peer
        payments between users within Niyah.
      </P>

      <H2>Acceptable Use &amp; Right to Refuse Service</H2>
      <P>
        You agree not to create fake or multiple accounts, manipulate sessions,
        rewards, or promotions, engage in fraudulent payment activity, use Niyah for
        money laundering or any unlawful purpose, or reverse engineer or interfere
        with the Service. Niyah reserves the right to refuse, suspend, or terminate
        service to anyone, at any time, for conduct we reasonably believe violates
        these Terms or creates legal or financial risk.
      </P>

      <H2>Suspension &amp; Termination</H2>
      <P>
        We may suspend or terminate your access for any violation of these Terms or
        suspected fraud. Where lawful, we’ll return your deposited funds; amounts
        subject to unmet eligibility conditions may be forfeited. Provisions that
        should reasonably survive termination (such as disclaimers, limitation of
        liability, and indemnity) will continue to apply.
      </P>

      <H2>Changes to Niyah &amp; These Terms</H2>
      <P>
        We may add, change, or remove features, and we may update these Terms. When
        we make material changes to these Terms, you’ll be prompted to review and
        accept the new version before continuing to use the app. Continuing to use
        Niyah after changes take effect means you accept them.
      </P>

      <H2>Disclaimers, Limitation of Liability &amp; Indemnity</H2>
      <Caps>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES OF
        ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE
        DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR
        ERROR-FREE.
      </Caps>
      <Caps>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, NIYAH WILL NOT BE LIABLE FOR ANY
        INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR
        ANY LOSS OF PROFITS OR DATA, ARISING FROM YOUR USE OF THE SERVICE. NIYAH’S
        TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED THE
        GREATER OF THE AMOUNT YOU DEPOSITED IN THE 12 MONTHS BEFORE THE CLAIM OR US
        $100.
      </Caps>
      <P>
        You agree to indemnify and hold Niyah harmless from claims, losses, and
        expenses (including reasonable legal fees) arising from your misuse of the
        Service or violation of these Terms or applicable law.
      </P>

      <H2>Apple App Store</H2>
      <P>
        These Terms are between you and Niyah only, not Apple. Apple has no
        responsibility for the app or its content and is not obligated to provide
        any maintenance or support for it. Apple makes no warranties regarding the
        app and, to the maximum extent permitted by law, is not responsible for any
        claims relating to the app, including product-liability, legal/regulatory,
        or consumer-protection claims. You agree to use the app in compliance with
        the Apple Media Services Terms and Usage Rules. Apple and its subsidiaries
        are third-party beneficiaries of these Terms and may enforce them against
        you.
      </P>

      <H2>Governing Law &amp; Disputes</H2>
      <P>
        These Terms are governed by the laws of the State of Delaware, without
        regard to its conflict-of-laws rules. You and Niyah agree to first try to resolve
        any dispute informally by contacting us. Any dispute not resolved informally
        will be subject to the exclusive jurisdiction of the state and federal
        courts located in the State of Delaware. We may still seek injunctive
        relief in any appropriate jurisdiction.
      </P>

      <H2>Miscellaneous</H2>
      <P>
        If any part of these Terms is found unenforceable, the rest stays in effect.
        Our failure to enforce a right isn’t a waiver of it. We aren’t responsible
        for failures caused by events beyond our reasonable control. These Terms
        were drafted in U.S. English; if we provide a translation and there’s a
        conflict, the English version controls.
      </P>

      <H2>Contact</H2>
      <P>
        Questions about these Terms? Email us at <Mail />.
      </P>
    </article>
  );
}
