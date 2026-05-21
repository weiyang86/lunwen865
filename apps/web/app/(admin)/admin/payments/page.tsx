'use client';
import { useEffect, useState } from 'react';
import { clientHttp } from '@/lib/client/api-client';
export default function AdminPaymentsPage(){
  const [data,setData]=useState<any>({items:[]});
  useEffect(()=>{clientHttp.get('/admin/payment/records').then(setData);},[]);
  return <div className='p-6'><h1 className='text-xl font-semibold mb-3'>支付记录</h1><div className='space-y-2'>{(data.items||[]).map((x:any)=><div key={x.id} className='border p-2 text-sm'>{x.paymentNo} | {x.channel} | {x.method} | {x.status} | {x.providerTradeNo||'-'}</div>)}</div></div>
}
