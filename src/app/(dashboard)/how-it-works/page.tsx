
'use client';

// src/app/(dashboard)/how-it-works/page.tsx

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Coins,
  Gavel,
  Shield,
  Sparkles,
} from 'lucide-react';

const steps = [
  {
    icon: BookOpen,
    number: '01',
    title: 'Submit a Claim',
    description:
      'Anyone can submit a claim about a piece of information. Provide a clear title, source URL, and supporting evidence. A small stake helps prevent spam and low-quality submissions.',
  },
  {
    icon: Shield,
    number: '02',
    title: 'Community Verification',
    description:
      'Verified community members review the claim and vote on its accuracy. Verifiers stake tokens behind their verdict, aligning incentives with honest evaluation.',
  },
  {
    icon: Gavel,
    number: '03',
    title: 'Dispute Resolution',
    description:
      'If a result is contested, a dispute round opens. A wider panel of verifiers re-evaluates the evidence and reaches a final majority verdict.',
  },
  {
    icon: Coins,
    number: '04',
    title: 'Rewards & Penalties',
    description:
      "Verifiers who vote with the majority earn a share of the losing side's stake. Honest participation is rewarded while inaccurate or malicious claims can result in stake loss.",
  },
  {
    icon: CheckCircle2,
    number: '05',
    title: 'Human Verification',
    description:
      'Verifier participation requires proof of unique humanity. This helps prevent Sybil attacks and supports one-person-one-vote integrity across the platform.',
  },
];

const faqs = [
  {
    q: 'Do I need to connect a wallet?',
    a: 'Yes. A wallet is required to stake tokens, submit claims, and earn rewards. The exact wallet options depend on the network and wallet integrations currently supported by TruthBounty.',
  },
  {
    q: 'What tokens are used for staking?',
    a: 'TruthBounty uses a platform token on the Optimism network. During the beta period, tokens can be acquired through the in-app faucet.',
  },
  {
    q: 'How long does verification take?',
    a: 'Most claims are resolved within 48 hours. Disputed claims may take longer, sometimes up to 7 days, depending on the complexity of the evidence and dispute process.',
  },
  {
    q: 'Is my identity exposed when I verify?',
    a: 'No personal identity information is intended to be exposed through the humanity-verification process. The system is designed to establish uniqueness without unnecessarily revealing personal information.',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-gray-50/70 dark:bg-gray-950">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white px-6 py-10 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:px-10 sm:py-14">
          {/* Decorative background */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-100/60 blur-3xl dark:bg-indigo-950/30"
          />

          <div className="relative max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-4xl lg:text-5xl">
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300">
                <Sparkles className="h-3.5 w-3.5" />
                How TruthBounty works
              </span>
              <span className="block">Turn information into</span>
              <span className="block text-indigo-600 dark:text-indigo-400">
                accountable truth.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-7 text-gray-600 dark:text-gray-400 sm:text-base">
              TruthBounty uses community verification, economic incentives,
              and proof of unique participation to help separate reliable
              information from false or misleading claims.
            </p>

            {/* Quick overview */}
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Submit evidence
              </div>

              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Stake on decisions
              </div>

              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Earn for accuracy
              </div>
            </div>
          </div>
        </section>

        {/* Process */}
        <section
          aria-labelledby="process-heading"
          className="mt-12 sm:mt-16"
        >
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              The verification lifecycle
            </p>

            <h2
              id="process-heading"
              className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl"
            >
              From claim to consensus
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
              Every claim follows a transparent process designed to encourage
              careful research and honest participation.
            </p>
          </div>

          <ol className="relative space-y-4">
            {/* Connecting line */}
            <div
              aria-hidden="true"
              className="absolute bottom-8 left-[25px] top-8 hidden w-px bg-gray-200 dark:bg-gray-800 sm:block"
            />

            {steps.map((step) => {
              const Icon = step.icon;

              return (
                <li
                  key={step.title}
                  className="group relative rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-900 sm:p-6"
                >
                  <div className="flex gap-4 sm:gap-5">
                    {/* Icon */}
                    <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                      <Icon
                        className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
                        aria-hidden="true"
                      />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-xs font-bold tracking-widest text-gray-400 dark:text-gray-600">
                          {step.number}
                        </span>

                        <h3 className="text-base font-semibold text-gray-900 dark:text-white sm:text-lg">
                          {step.title}
                        </h3>
                      </div>

                      <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
                        {step.description}
                      </p>
                    </div>

                    <ArrowRight
                      className="mt-1 hidden h-5 w-5 shrink-0 text-gray-300 transition-transform group-hover:translate-x-1 dark:text-gray-700 sm:block"
                      aria-hidden="true"
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Incentive section */}
        <section className="mt-12 sm:mt-16">
          <div className="rounded-3xl border border-gray-200 bg-gray-900 p-6 text-white shadow-sm dark:border-gray-800 sm:p-8">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  <Coins className="h-5 w-5 text-white" />
                </div>

                <h2 className="text-xl font-bold sm:text-2xl">
                  Your stake backs your judgment.
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-300">
                  TruthBounty is designed so that verification is more than
                  simply clicking a button. Participants have an economic
                  incentive to investigate evidence carefully and make
                  defensible decisions.
                </p>
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-3 sm:w-64">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-gray-400">Accurate</p>
                  <p className="mt-1 text-sm font-semibold">Earn rewards</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-gray-400">Inaccurate</p>
                  <p className="mt-1 text-sm font-semibold">Risk stake</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          aria-labelledby="faq-heading"
          className="mt-12 sm:mt-16"
        >
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Need to know
            </p>

            <h2
              id="faq-heading"
              className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl"
            >
              Frequently asked questions
            </h2>
          </div>

          <div className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group px-5 sm:px-6"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white sm:text-base">
                    {faq.q}
                  </span>

                  <ChevronDown
                    className="h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>

                <div className="max-w-3xl pb-5 pr-8">
                  <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">
                    {faq.a}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mt-12 pb-4 text-center sm:mt-16">
          <div className="mx-auto max-w-xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
              Ready to verify?
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
              Explore active claims and help the community determine what
              deserves to be trusted.
            </p>

            <Link
              href="/"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              Explore claims
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
