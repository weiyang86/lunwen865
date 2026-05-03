'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { AlertTriangle, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  hasDraft: boolean;
  onClose: () => void;
  onConfirm: () => void;
  submitting?: boolean;
}

export function DiscardDraftDialog({
  open,
  hasDraft,
  onClose,
  onConfirm,
  submitting = false,
}: Props) {
  const canConfirm = hasDraft && !submitting;

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => (!submitting ? onClose() : null)}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <Dialog.Title className="text-base font-semibold text-slate-900">
                    丢弃草稿
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    aria-label="关闭"
                    disabled={submitting}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    <span className="font-medium">此操作无法撤销</span>
                  </div>
                </div>

                <div className="mt-3 text-sm text-slate-700">
                  {hasDraft
                    ? '丢弃后将回到当前已发布版本，所有未保存的修改都会丢失。'
                    : '当前没有未保存的修改，无需丢弃。'}
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="ghost" onClick={onClose} disabled={submitting}>
                    取消
                  </Button>
                  <Button
                    onClick={onConfirm}
                    disabled={!canConfirm}
                    className="bg-rose-600 text-white hover:bg-rose-700"
                  >
                    确认丢弃
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

