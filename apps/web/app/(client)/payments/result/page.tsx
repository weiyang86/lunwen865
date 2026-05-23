'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clientHttp } from '@/lib/client/api-client';
export default function PaymentResultPage(){
  const sp=useSearchParams(); const orderId=sp?.get('orderId')||''; const [s,setS]=useState<any>(null);
  const refresh=()=>clientHttp.get(`/orders/${orderId}/payment-status`).then(setS);
  useEffect(()=>{refresh();},[orderId]);
  return <div className='p-6 space-y-2'><h1 className='text-xl font-semibold'>支付结果</h1><div>订单: {orderId}</div><div>状态: {s?.status||'加载中'}</div><button className='border px-3 py-1' onClick={refresh}>刷新状态</button></div>
}
