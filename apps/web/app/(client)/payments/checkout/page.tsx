'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { clientHttp } from '@/lib/client/api-client';


function submitAlipayFormHtml(html: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const form = doc.querySelector('form');
  if (!form) return false;

  const targetForm = document.createElement('form');
  targetForm.method = (form.getAttribute('method') || 'post').toLowerCase() === 'get' ? 'get' : 'post';
  targetForm.action = form.getAttribute('action') || '';
  targetForm.acceptCharset = form.getAttribute('accept-charset') || 'utf-8';
  targetForm.style.display = 'none';

  for (const input of Array.from(form.querySelectorAll('input'))) {
    const name = input.getAttribute('name');
    if (!name) continue;
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = name;
    hidden.value = input.getAttribute('value') || '';
    targetForm.appendChild(hidden);
  }

  document.body.appendChild(targetForm);
  targetForm.submit();
  return true;
}

function isMobile() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function CheckoutPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const orderId = sp?.get('orderId') || '';
  const [submitting, setSubmitting] = useState<null | 'wechat' | 'alipay'>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => orderId.trim().length > 0, [orderId]);

  const go = async (channel: 'wechat' | 'alipay') => {
    if (!canSubmit) {
      setError('缺少订单号，请返回订单页重新发起支付。');
      return;
    }
    setSubmitting(channel);
    setError(null);
    try {
      const mobile = isMobile();
      const method =
        channel === 'wechat' ? (mobile ? 'h5' : 'native') : mobile ? 'wap' : 'page';
      const res = await clientHttp.post<Record<string, unknown>>('/payments/create', {
        orderId,
        channel,
        method,
      });

      const qr =
        (typeof res['qrCodeUrl'] === 'string' && res['qrCodeUrl']) ||
        (typeof res['codeUrl'] === 'string' && res['codeUrl']) ||
        null;
      if (qr) {
        router.push(
          `/payments/wechat-qrcode?orderId=${encodeURIComponent(orderId)}&qr=${encodeURIComponent(qr)}`,
        );
        return;
      }

      const payUrl =
        (typeof res['payUrl'] === 'string' && res['payUrl']) ||
        (typeof res['paymentUrl'] === 'string' && res['paymentUrl']) ||
        (typeof res['mwebUrl'] === 'string' && res['mwebUrl']) ||
        null;

      if (payUrl) {
        window.location.href = payUrl;
        return;
      }

      const html =
        (typeof res['html'] === 'string' && res['html']) ||
        (typeof res['formHtml'] === 'string' && res['formHtml']) ||
        (typeof res['form'] === 'string' && res['form']) ||
        null;
      if (html && submitAlipayFormHtml(html)) {
        return;
      }

      setError('发起支付失败：未获取到支付链接或支付表单。');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '发起支付失败，请稍后重试。');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">选择支付方式</h1>
      <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-600">订单号：{orderId || '未提供'}</div>
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void go('wechat')} disabled={!canSubmit || submitting !== null}>
          {submitting === 'wechat' ? '发起中...' : '微信支付'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void go('alipay')}
          disabled={!canSubmit || submitting !== null}
        >
          {submitting === 'alipay' ? '发起中...' : '支付宝支付'}
        </Button>
      </div>
    </div>
  );
}
