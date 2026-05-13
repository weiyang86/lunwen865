import type { ReactNode } from 'react';
import { AgencyPageEmpty } from './agency-page-empty';
import { AgencyPageError } from './agency-page-error';
import { AgencyPageLoading } from './agency-page-loading';

export type AgencyPageViewState = 'success' | 'loading' | 'empty' | 'error';

export function resolveAgencyPageState(raw: string | string[] | undefined): AgencyPageViewState {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'loading' || value === 'empty' || value === 'error') return value;
  return 'success';
}

export function AgencyPageState(props: {
  title: string;
  state: AgencyPageViewState;
  emptyMessage: string;
  errorMessage: string;
  children: ReactNode;
}) {
  const { title, state, emptyMessage, errorMessage, children } = props;

  if (state === 'loading') return <AgencyPageLoading title={title} />;
  if (state === 'empty') return <AgencyPageEmpty title={title} message={emptyMessage} />;
  if (state === 'error') return <AgencyPageError title={title} message={errorMessage} />;

  return <>{children}</>;
}
