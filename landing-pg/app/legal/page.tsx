import Link from "next/link";

export const metadata = {
  title: "Legal - Niyah",
  description: "Niyah's Terms of Service and Privacy Policy.",
};

export default function LegalIndexPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold">Legal</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        The agreements that govern your use of Niyah.
      </p>
      <ul className="space-y-5">
        <li>
          <Link
            href="/legal/terms"
            className="text-lg text-primary underline underline-offset-2"
          >
            Terms of Service
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            The agreement between you and Niyah, Inc. for using the app.
          </p>
        </li>
        <li>
          <Link
            href="/legal/privacy"
            className="text-lg text-primary underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            What we collect, how we use it, and how we protect it.
          </p>
        </li>
      </ul>
    </article>
  );
}
