'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { clientHttp } from '@/lib/client/api-client';

function isMobile(){ if(typeof navigator==='undefined') return false; return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }
export default function CheckoutPage(){
  const sp = useSearchParams(); const orderId = sp?.get('orderId') || ''; const router = useRouter();
  const go = async (channel:'wechat'|'alipay')=>{
    const mobile=isMobile();
    const method = channel==='wechat' ? (mobile?'h5':'native') : (mobile?'wap':'page');
    const res:any = await clientHttp.post('/payments/create',{orderId,channel,method});
    if (res.qrCodeUrl || res.codeUrl) return router.push(`/payments/wechat-qrcode?orderId=${orderId}&qr=${encodeURIComponent(res.qrCodeUrl||res.codeUrl)}`);
    if (res.payUrl || res.mwebUrl) { window.location.href = res.payUrl || res.mwebUrl; return; }
    alert('发起支付失败');
  };
  return <div className='p-6 space-y-3'><h1 className='text-xl font-semibold'>选择支付方式</h1>
    <button className='rounded bg-green-600 text-white px-3 py-2 mr-2' onClick={()=>go('wechat')}>微信支付</button>
    <button className='rounded bg-blue-600 text-white px-3 py-2' onClick={()=>go('alipay')}>支付宝支付</button>
  </div>;
}
