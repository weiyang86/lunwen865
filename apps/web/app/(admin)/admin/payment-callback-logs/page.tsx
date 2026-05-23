'use client';
import { useEffect, useState } from 'react';
import { clientHttp } from '@/lib/client/api-client';
export default function AdminCallbackLogsPage(){
  const [data,setData]=useState<any>({items:[]});
  useEffect(()=>{clientHttp.get('/admin/payment/callback-logs').then(setData);},[]);
  return <div className='p-6'><h1 className='text-xl font-semibold mb-3'>支付回调日志</h1><div className='space-y-2'>{(data.items||[]).map((x:any)=><div key={x.id} className='border p-2 text-sm'>{x.channel} | verified={String(x.verified)} | {x.processStatus} | {x.errorMessage||'-'}</div>)}</div></div>
}
