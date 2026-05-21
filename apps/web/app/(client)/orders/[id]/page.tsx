'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { clientHttp } from '@/lib/client/api-client';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? ''; 
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  useEffect(() => { clientHttp.get(`/orders/${id}`).then(setOrder); }, [id]);
  if (!order) return <div className="p-6">加载中...</div>;
  return <div className="p-6 space-y-2">
    <h1 className="text-xl font-semibold">订单确认</h1>
    <div>订单号: {order.orderNo}</div><div>金额: ¥{(order.amountCents/100).toFixed(2)}</div><div>状态: {order.status}</div>
    <div>过期时间: {order.expiresAt}</div>
    {order.status === 'PENDING' ? <button className="rounded bg-black text-white px-3 py-2" onClick={()=>router.push(`/payments/checkout?orderId=${order.id}`)}>继续支付</button> : <div>当前状态不可支付</div>}
  </div>;
}
