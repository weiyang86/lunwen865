'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clientHttp } from '@/lib/client/api-client';

export default function WechatQrPage(){
  const sp=useSearchParams(); const orderId=sp?.get('orderId')||''; const qr=sp?.get('qr')||''; const [status,setStatus]=useState('PENDING');
  useEffect(()=>{const t=setInterval(async()=>{ const s:any=await clientHttp.get(`/orders/${orderId}/payment-status`); setStatus(s.status); if(['PAID','COMPLETED'].includes(s.status)){window.location.href=`/payments/result?orderId=${orderId}`;} },3000); return ()=>clearInterval(t);},[orderId]);
  return <div className='p-6 space-y-2'><h1 className='text-xl font-semibold'>微信扫码支付</h1><div>订单: {orderId}</div><div>状态: {status}</div><div className='break-all text-xs'>{qr}</div></div>
}
