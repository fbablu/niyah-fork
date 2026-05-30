"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Is this gambling?",
    answer:
      "No. Niyah is a commitment contract, the same model used by stickK and Beeminder for over 10 years. Whether you keep your money is entirely determined by your own effort and discipline, not luck or chance. The outcome is skill-based: you choose to stay focused or you choose to surrender. The app is categorized as Productivity, not Games.",
  },
  {
    question: "How does the app actually block my apps?",
    answer:
      "Niyah uses Apple's Screen Time API (FamilyControls) to block apps at the system level. This isn't a \"are you sure?\" nudge. It's a real block. You either pick which apps to block or let Niyah auto-select your most-used distracting apps. Once a session starts, those apps show a branded block screen. Even deleting the app won't bypass the block because FamilyControls persists independently.",
  },
  {
    question: "What happens if I quit a session early?",
    answer:
      "If you surrender during a session, you forfeit part or all of your stake to Niyah. It's never paid to other users and never pooled. The only way out of the app block is to surrender, and that's the point: the stake is what makes the commitment real.",
  },
  {
    question: "Where does my forfeited money go?",
    answer:
      "Straight to Niyah, the house. It's never redistributed to other users, never pooled, and there are no peer-to-peer payments between users. That's a core part of what keeps Niyah a commitment contract and not gambling.",
  },
  {
    question: "How do payments work?",
    answer:
      "Deposits, stakes, and payouts all run through Stripe, with Plaid for linking your bank to withdraw. Your money is handled by those providers, never directly by the app. No Venmo, no peer-to-peer settlement, no IOUs between friends.",
  },
  {
    question: "Can I use Niyah solo?",
    answer:
      "Solo mode exists, but group sessions are where Niyah really shines. Financial stakes plus social accountability together create a fundamentally different incentive structure. Start by inviting a few friends, that's the strongest path to actually changing your habits.",
  },
  {
    question: "How much should I stake?",
    answer:
      "That's entirely up to you. Small daily stakes ($1 to $5) work great for building habits. Larger weekly or monthly stakes ($10 to $50) are better for serious commitments. The key is that the amount needs to be meaningful enough to you that you'll actually follow through.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="px-6 py-20 md:py-28">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-wider text-primary">
            FAQ
          </p>
          <h2 className="mb-4 text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl lg:text-5xl text-balance">
            Questions you might have.
          </h2>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
