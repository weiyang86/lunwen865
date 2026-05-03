'use client';

import type { RefObject, UIEvent } from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PromptTestOutputView({
  output,
  streaming,
  errorBanner,
  footer,
  scrollRef,
  onScroll,
}: {
  output: string;
  streaming: boolean;
  errorBanner?: { title: string; message?: string; countdownText?: string };
  footer?: string;
  scrollRef?: RefObject<HTMLDivElement | null>;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
}) {
  const canCopy = output.trim().length > 0;

  return (
    <div className="space-y-2">
      {errorBanner ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <div className="font-medium">{errorBanner.title}</div>
          {errorBanner.message ? (
            <div className="mt-1 text-xs text-rose-700">{errorBanner.message}</div>
          ) : null}
          {errorBanner.countdownText ? (
            <div className="mt-1 text-xs text-rose-700">{errorBanner.countdownText}</div>
          ) : null}
        </div>
      ) : null}

      <div className="relative rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm">
        {canCopy ? (
          <Button
            size="icon-sm"
            variant="ghost"
            className="absolute right-2 top-2"
            onClick={async () => {
              await navigator.clipboard.writeText(output);
              toast.success('已复制');
            }}
            title="复制"
          >
            <Copy className="h-4 w-4" />
          </Button>
        ) : null}

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="min-h-32 max-h-96 overflow-auto whitespace-pre-wrap break-words"
        >
          {output.trim().length === 0 ? (
            <div className="text-sm text-slate-400">点击 [运行] 开始测试</div>
          ) : (
            <>
              {output}
              {streaming ? (
                <span className={cn('ml-0.5 inline-block h-4 w-2 bg-slate-400 align-text-bottom', 'animate-pulse')} />
              ) : null}
            </>
          )}
        </div>
      </div>

      {footer ? <div className="text-xs text-slate-500 tabular-nums">{footer}</div> : null}
    </div>
  );
}
