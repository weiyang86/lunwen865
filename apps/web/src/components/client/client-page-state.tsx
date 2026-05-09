import type { ReactNode } from 'react';
import { ClientPageEmpty } from './client-page-empty';
import { ClientPageError } from './client-page-error';
import { ClientPageLoading } from './client-page-loading';

export type ClientPageViewState = 'success' | 'loading' | 'empty' | 'error';

export function resolveClientPageState(
  raw: string | string[] | undefined,
): ClientPageViewState {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'loading' || value === 'empty' || value === 'error') return value;
  return 'success';
}

export function ClientPageState(props: {
  title: string;
  state: ClientPageViewState;
  emptyMessage: string;
  errorMessage: string;
  children: ReactNode;
}) {
  const { title, state, emptyMessage, errorMessage, children } = props;

  if (state === 'loading') return <ClientPageLoading title={title} />;
  if (state === 'empty') {
    return <ClientPageEmpty title={title} message={emptyMessage} />;
  }
  if (state === 'error') {
    return <ClientPageError title={title} message={errorMessage} />;
  }

  return <>{children}</>;
}
