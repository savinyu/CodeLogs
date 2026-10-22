import Link from "next/link";
import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";
import { Panel } from "@/components/kit/panel";

export const metadata = {
  title: "Privacy policy",
  description: "What LogN and its browser extension collect, and what they do with it.",
};

const ISSUES_URL = "https://github.com/savinyu/LogN/issues";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel as="section" className="grid gap-3">
      <h2 className="font-display text-xl leading-tight font-semibold tracking-[-0.01em]">
        {title}
      </h2>
      {children}
    </Panel>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="grid list-disc gap-1.5 pl-5 text-muted-foreground">{children}</ul>;
}

export default function PrivacyPage() {
  return (
    <Page className="max-w-3xl">
      <PageHead
        title="Privacy policy"
        description="What LogN and the LogN browser extension collect, and what they do with it. Last updated 19 October 2026."
      />
      <div className="grid gap-3.5">
        <Section title="Who we are">
          <p className="text-muted-foreground">
            LogN is a free, non-commercial project that tracks your competitive programming and DSA
            practice. It is not affiliated with Codeforces, AtCoder, LeetCode, CodeChef, Coding
            Ninjas (Code360), HackerRank, InterviewBit or GeeksforGeeks.
          </p>
        </Section>

        <Section title="What LogN stores">
          <List>
            <li>
              Your account: the name, email address and avatar GitHub or Google share when you sign
              in, and your LogN username.
            </li>
            <li>
              Sign-in sessions: the IP address and browser user agent of each session, used only to
              keep you signed in.
            </li>
            <li>The platform handles you add, and whether each one is verified.</li>
            <li>
              Your solved problems, solve dates, ratings, contest results and daily activity, read
              from the public APIs of Codeforces, AtCoder and LeetCode or uploaded by the browser
              extension.
            </li>
            <li>
              What you do in LogN: settings, daily goal, sheet ticks, daily marks, friends and
              social links you add.
            </li>
            <li>Extension tokens, stored only as a hash, with the time each one was last used.</li>
            <li>
              Feedback you send: the message, the email you give for a reply (optional), your
              account if you&apos;re signed in, and a one-way hash of your IP address, used only to
              limit how often feedback can be sent.
            </li>
          </List>
          <p className="text-muted-foreground">
            LogN has no ads and no analytics or tracking scripts.
          </p>
        </Section>

        <Section title="The browser extension">
          <p className="text-muted-foreground">
            LeetCode, CodeChef, Code360, HackerRank, InterviewBit and GeeksforGeeks don&apos;t share
            your full solved history publicly, so the extension reads it in your own browser, where
            you are already logged in to those sites. It runs once when you connect it, while you
            browse those sites (at most every 6 hours per site, LeetCode also once a day), and
            whenever you click Sync. You can turn automatic sync off in its popup.
          </p>
          <p className="text-muted-foreground">It sends to LogN, and nowhere else:</p>
          <List>
            <li>your username on each platform;</li>
            <li>
              the problems you solved: ids, titles, links, difficulty labels, tags where the site
              gives them, and solve dates;
            </li>
            <li>solved counts and daily submission counts.</li>
          </List>
          <p className="text-muted-foreground">
            It never sends passwords, cookies, login tokens from those sites, your email address,
            your code or your browsing history. It only reads the sites you grant it access to, and
            you can decline or withdraw access to any of them, LeetCode included, in its prompts or
            in your browser&apos;s site-access settings for the extension.
          </p>
          <p className="text-muted-foreground">
            In your browser it keeps the LogN token it receives when you connect, its settings, and
            the result of each platform&apos;s last sync. Removing the extension deletes them; you
            can also revoke a connected browser on the Connect page.
          </p>
        </Section>

        <Section title="Who can see your data">
          <List>
            <li>
              Your profile page and your place on the global leaderboard are public only if you turn
              them on in Settings. Both are off by default.
            </li>
            <li>Friends you add see your activity and weekly points on their friends board.</li>
            <li>
              Your data is never sold or shared for advertising. It is processed only by the
              services that run LogN: Vercel (hosting), Neon (database), Inngest (background sync),
              and GitHub or Google (sign-in).
            </li>
          </List>
        </Section>

        <Section title="Your choices">
          <List>
            <li>Remove a platform handle on the Connect page; its solves are removed with it.</li>
            <li>
              Download all your data, or delete your account and everything in it, in Settings.
            </li>
            <li>Disconnect or uninstall the extension at any time.</li>
          </List>
        </Section>

        <Section title="Contact">
          <p className="text-muted-foreground">
            Questions or requests:{" "}
            <Link href="/feedback" className="text-foreground underline underline-offset-2">
              send feedback
            </Link>{" "}
            or{" "}
            <Link href={ISSUES_URL} className="text-foreground underline underline-offset-2">
              open an issue on GitHub
            </Link>
            . Changes to this policy are posted on this page.
          </p>
        </Section>
      </div>
    </Page>
  );
}
