'use client';

import { useEffect, useMemo, useState } from 'react';
import { Package, Plus, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { UsersPagination } from '@/components/admin/users/users-pagination';
import { BatchActionBar } from '@/components/admin/products/batch-action-bar';
import { CategoryTreePanel } from '@/components/admin/products/category-tree-panel';
import { ConfirmProductActionDialog, type ProductConfirmAction } from '@/components/admin/products/confirm-product-action-dialog';
import { ProductFilterBar } from '@/components/admin/products/product-filter-bar';
import { ProductTable } from '@/components/admin/products/product-table';
import { useCategoryTree } from '@/hooks/admin/use-category-tree';
import { useProductList } from '@/hooks/admin/use-product-list';
import type { ProductListItem } from '@/types/admin/product';

export default function ProductsPage() {
  const categories = useCategoryTree();
  const products = useProductList();

  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ProductConfirmAction | null>(null);

  useEffect(() => {
    categories.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    products.setCategory(categories.selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.selectedId]);

  const selectedCategoryName = useMemo(() => {
    if (!categories.selectedId) return '全部商品';
    return categories.flatMap.get(categories.selectedId)?.name ?? '全部商品';
  }, [categories.flatMap, categories.selectedId]);

  const categoryLockedAll = !categories.selectedId;

  function handleCreateProduct() {
    console.log('[7C-pending] open product form: create');
    toast.info('商品编辑表单将在 7C 实现');
  }

  function handleEditProduct(id: string) {
    console.log('[7C-pending] open product form: edit', id);
    toast.info('商品编辑表单将在 7C 实现');
  }

  function openConfirm(a: ProductConfirmAction) {
    setConfirmAction(a);
    setConfirmOpen(true);
  }

  async function runConfirm() {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      if (confirmAction.type === 'toggle') {
        await products.updateStatus(confirmAction.id, confirmAction.next);
      } else if (confirmAction.type === 'remove') {
        await products.removeOne(confirmAction.id);
      } else if (confirmAction.type === 'batch-toggle') {
        await products.batchStatus(Array.from(products.selectedIds), confirmAction.next);
      } else {
        await products.batchRemove(Array.from(products.selectedIds));
      }
      setConfirmOpen(false);
      setConfirmAction(null);
    } finally {
      setConfirmLoading(false);
    }
  }

  function confirmToggle(p: ProductListItem) {
    if (p.status === 'DRAFT') return;
    const next = p.status === 'ON_SALE' ? 'OFF_SHELF' : 'ON_SALE';
    openConfirm({ type: 'toggle', id: p.id, next, name: p.name });
  }

  function confirmRemove(p: ProductListItem) {
    openConfirm({ type: 'remove', id: p.id, name: p.name });
  }

  const selectedCount = products.selectedCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">商品管理</h1>
          <p className="text-sm text-slate-500">管理分类与商品上下架</p>
        </div>
        <Button onClick={handleCreateProduct}>
          <Plus className="h-4 w-4" />
          新增商品
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col md:flex-row">
          <div className="hidden w-72 shrink-0 border-r border-slate-200 md:block">
            <CategoryTreePanel
              tree={categories.tree}
              loading={categories.loading}
              selectedId={categories.selectedId}
              expandedIds={categories.expandedIds}
              selectCategory={(id) => categories.selectCategory(id)}
              toggleExpand={categories.toggleExpand}
              getNodeDepth={categories.getNodeDepth}
              onCreate={(p) => categories.create(p)}
              onUpdate={(id, p) => categories.update(id, p)}
              onRemove={(id) => categories.remove(id)}
              onReorder={(parentId, orderedIds) => categories.reorder(parentId, orderedIds)}
            />
          </div>

          <div className="flex-1">
            <div className="border-b border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 md:hidden">
                  <Sheet open={mobileTreeOpen} onOpenChange={setMobileTreeOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Package className="h-4 w-4" />
                        当前分类：{selectedCategoryName}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-full sm:max-w-sm">
                      <SheetHeader>
                        <SheetTitle>商品分类</SheetTitle>
                      </SheetHeader>
                      <div className="mt-4 flex h-full flex-col">
                        <CategoryTreePanel
                          tree={categories.tree}
                          loading={categories.loading}
                          selectedId={categories.selectedId}
                          expandedIds={categories.expandedIds}
                          selectCategory={(id) => {
                            categories.selectCategory(id);
                            setMobileTreeOpen(false);
                          }}
                          toggleExpand={categories.toggleExpand}
                          getNodeDepth={categories.getNodeDepth}
                          onCreate={(p) => categories.create(p)}
                          onUpdate={(id, p) => categories.update(id, p)}
                          onRemove={(id) => categories.remove(id)}
                          onReorder={(parentId, orderedIds) =>
                            categories.reorder(parentId, orderedIds)
                          }
                        />
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>

                <ProductFilterBar
                  query={products.query}
                  categoryLockedAll={categoryLockedAll}
                  onChange={(patch) => products.setQuery({ ...products.query, ...patch })}
                />
              </div>
            </div>

            <div className="p-4">
              <ProductTable
                data={products.list}
                loading={products.loading}
                selectedIds={products.selectedIds}
                allSelectedInPage={products.allSelectedInPage}
                someSelectedInPage={products.someSelectedInPage}
                onToggleSelectAllInPage={products.toggleSelectAllInPage}
                onToggleSelect={products.toggleSelect}
                onCreate={handleCreateProduct}
                onEdit={handleEditProduct}
                onToggleStatus={(p) => confirmToggle(p)}
                onRemove={(p) => confirmRemove(p)}
              />
            </div>

            <div className="px-4 pb-4">
              <UsersPagination
                page={products.page}
                pageSize={products.pageSize}
                total={products.total}
                onChange={(page, pageSize) =>
                  products.setQuery({ ...products.query, page, pageSize })
                }
              />
            </div>
          </div>
        </div>
      </div>

      <BatchActionBar
        count={selectedCount}
        visible={selectedCount > 0}
        onBatchOnSale={() =>
          openConfirm({ type: 'batch-toggle', next: 'ON_SALE', count: selectedCount })
        }
        onBatchOffShelf={() =>
          openConfirm({ type: 'batch-toggle', next: 'OFF_SHELF', count: selectedCount })
        }
        onBatchRemove={() => openConfirm({ type: 'batch-remove', count: selectedCount })}
        onClear={products.clearSelection}
      />

      <ConfirmProductActionDialog
        open={confirmOpen}
        action={confirmAction}
        loading={confirmLoading}
        onConfirm={runConfirm}
        onClose={() => (confirmLoading ? null : setConfirmOpen(false))}
      />
    </div>
  );
}
