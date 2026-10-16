'use client';

import React, { useId, useMemo, useState } from 'react';
import {
  troubleshootingContent,
  type TroubleshootingCategory,
  type TroubleshootingCategoryId,
  type TroubleshootingState,
  type TroubleshootingStateTone,
} from './troubleshootingTopics';

const toneClasses: Record<TroubleshootingStateTone, string> = {
  neutral:
    'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200',
  info:
    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  danger:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
};

const kindLabels: Record<TroubleshootingState['kind'], string> = {
  transaction: 'Transaction',
  projection: 'Projection',
};

function StateBadge({ tone, children }: { tone: TroubleshootingStateTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

function StateDetail({ state }: { state: TroubleshootingState }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StateBadge tone={state.tone}>{kindLabels[state.kind]}</StateBadge>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          {state.name}
        </h3>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Observed
          </dt>
          <dd className="text-sm leading-6 text-gray-700 dark:text-gray-300">
            {state.observed}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Meaning
          </dt>
          <dd className="text-sm leading-6 text-gray-700 dark:text-gray-300">
            {state.meaning}
          </dd>
        </div>
      </dl>

      <ol className="space-y-3">
        {state.steps.map((step, index) => (
          <li key={step.id} className="flex gap-3">
            <span
              className="flex size-6 flex-none items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {step.label}
              </p>
              <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CategoryPanel({ category }: { category: TroubleshootingCategory }) {
  return (
    <section
      aria-labelledby={`troubleshootingCategory-${category.id}-heading`}
      className="space-y-4"
    >
      <div className="space-y-1">
        <h2
          id={`troubleshootingCategory-${category.id}-heading`}
          className="text-lg font-semibold text-gray-900 dark:text-white"
        >
          {category.title}
        </h2>
        <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">
          {category.summary}
        </p>
      </div>

      <div className="space-y-4">
        {category.states.map((state) => (
          <article
            key={state.id}
            className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            <StateDetail state={state} />
          </article>
        ))}
      </div>
    </section>
  );
}

export interface HelpTroubleshootingProps {
  /** Optional content override for testing and Storybook. */
  content?: typeof troubleshootingContent;
}

export default function HelpTroubleshooting({
  content = troubleshootingContent,
}: HelpTroubleshootingProps) {
  const [activeCategory, setActiveCategory] =
    useState<TroubleshootingCategoryId>(content.categories[0]?.id ?? 'wallet-network');
  const tabsId = useId('troubleshooting-tabs');

  const selectedCategory = useMemo(
    () =>
      content.categories.find((category) => category.id === activeCategory) ??
      content.categories[0],
    [content.categories, activeCategory]
  );

  if (!selectedCategory) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Help and troubleshooting
        </h1>
        <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">
          State-based recovery guidance. These steps do not auto-sign,
          auto-submit, or switch networks on your behalf.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Troubleshooting topics">
        {content.categories.map((category) => {
          const isActive = category.id === activeCategory;
          return (
            <button
              key={category.id}
              id={`${tabsId}-${category.id}-tab`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`troubleshootingCategory-${category.id}-heading`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveCategory(category.id)}
              className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${isActive ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'}`}
            >
              {category.title}
            </button>
          );
        })}
      </div>

      <div
        id={`troubleshootingCategory-${selectedCategory.id}-heading`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-${selectedCategory.id}-tab`}
        tabIndex={0}
        className="focus:outline-none"
      >
        <CategoryPanel category={selectedCategory} />
      </div>

      <section
        aria-labelledby="troubleshooting-escalation-heading"
        className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900"
      >
        <h2
          id="troubleshooting-escalation-heading"
          className="text-sm font-semibold text-gray-900 dark:text-white"
        >
          Escalation
        </h2>
        <ul className="space-y-2">
          {content.escalationChannels.map((channel) => (
            <li key={channel.id} className="text-sm leading-6 text-gray-700 dark:text-gray-300">
              <span className="font-medium text-gray-900 dark:text-white">
                {channel.label}:
              </span>{' '}
              {channel.available && channel.href ? (
                <a
                  href={channel.href}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 rounded text-blue-700 underline dark:text-blue-300"
                >
                  {channel.description ?? 'Open channel'}
                </a>
              ) : (
                <span className="text-gray-600 dark:text-gray-400">
                  {channel.description ?? 'Unavailable.'}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-gray-200 pt-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p>
          Version {content.metadata.version} — Release {content.metadata.release} — Last reviewed {
            content.metadata.freshnessTimestamp
          }
        </p>
        <p className="mt-1">
          Source:
          <a
            href={content.metadata.source}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 rounded underline"
          >
            {content.metadata.source}
          </a>
        </p>
      </footer>
    </div>
  );
}
