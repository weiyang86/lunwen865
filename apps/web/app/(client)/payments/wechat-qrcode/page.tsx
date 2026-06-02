'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

import { Button } from '@/components/ui/button';
import { clientHttp } from '@/lib/client/api-client';
import { getApiErrorMessage } from '@/lib/client/api-error';

type PaymentStatusResp = {
  status: string;
  paidAt?: string | null;
  orderNo?: string;
};

export default function WechatQrPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const orderId = sp?.get('orderId') || '';
  const qr = sp?.get('qr') || '';

  const [status, setStatus] = useState<string>('PENDING');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const canPoll = useMemo(() => Boolean(orderId), [orderId]);
  const qrValue = useMemo(() => decodeURIComponent(qr || ''), [qr]);

  const pollOnce = useCallback(async () => {
    if (!canPoll) return;
    try {
      const s = await clientHttp.post<PaymentStatusResp>(`/payment/orders/${orderId}/status/refresh`, {});
      setStatus(s.status);
      setError(null);
      if (s.status === 'PAID' || s.status === 'COMPLETED') {
        router.replace('/account');
      }
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '查询支付状态失败'));
    } finally {
      setLoading(false);
    }
  }, [canPoll, orderId, router]);

  useEffect(() => {
    if (!canPoll) {
      setLoading(false);
      return;
    }
    void pollOnce();
    timerRef.current = window.setInterval(() => {
      void pollOnce();
    }, 3000);
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [canPoll, pollOnce]);

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">扫码支付</h1>
      <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-600">订单号：{orderId || '未提供'}</div>

      {!qrValue ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          未获取到二维码链接，请返回订单页重新发起支付。
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border p-4">
          <QRCodeCanvas value={qrValue} size={220} includeMargin />
          <div className="text-xs text-slate-500 break-all">{qrValue}</div>
        </div>
      )}

      <div className="rounded-md border p-3 text-sm">
        状态：{loading ? '查询中...' : status}
      </div>

      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => void pollOnce()} disabled={!canPoll}>
          我已完成支付，刷新状态
        </Button>
        <Button variant="secondary" onClick={() => router.push(`/payments/result?orderId=${encodeURIComponent(orderId)}`)}>
          去支付结果页
        </Button>
      </div>
    </div>
  );
}
