'use client';

import { Breadcrumbs } from './breadcrumbs';
import { UserMenu } from './user-menu';

export function Topbar() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <Breadcrumbs />
      <div className="flex items-center gap-3">
        <UserMenu />
      </div>
    </header>
  );
}

