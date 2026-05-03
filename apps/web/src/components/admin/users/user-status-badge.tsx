'use client';

import { Badge } from '@/components/ui/badge';
import type { UserStatus } from '@/types/admin/user';

export function UserStatusBadge({ status }: { status: UserStatus }) {
  if (status === 'ACTIVE') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        正常
      </Badge>
    );
  }
  return (
    <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
      已停用
    </Badge>
  );
}
