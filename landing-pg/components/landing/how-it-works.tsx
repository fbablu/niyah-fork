import { Users, Lock, Trophy } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Users,
    title: "Stake with friends",
    description:
      "Create a focus session and invite friends. Everyone stakes their own money on their own goal before the clock starts. Nothing is pooled.",
  },
  {
    number: "02",
    icon: Lock,
    title: "Apps get blocked",
    description:
      "Niyah uses Apple's Screen Time API to actually block your distracting apps at the system level. No bypassing, no honor system.",
  },
  {
    number: "03",
    icon: Trophy,
    title: "Earn it back",
    description:
      "Finish the session and your full stake comes back. Quit early and you forfeit it to the house. You're playing against your own worst impulses, not other people.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-t border-border bg-secondary/30 px-6 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 max-w-2xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-wider text-primary">
            How It Works
          </p>
          <h2 className="mb-4 text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl lg:text-5xl text-balance">
            Trap your money. Rescue it through discipline.
          </h2>
          <p className="text-lg text-muted-foreground">
            The outcome is entirely in your hands. This is a skill-based
            commitment contract. You decide whether you earn your stake back.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 md:gap-12">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className="absolute left-8 top-16 hidden h-px w-full bg-border md:block"
                  style={{ width: "calc(100% + 3rem)" }}
                />
              )}

              <div className="relative flex flex-col">
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <step.icon className="h-7 w-7" />
                  </div>
                  <span className="text-4xl font-bold text-border">
                    {step.number}
                  </span>
                </div>
                <h3 className="mb-3 text-xl font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
