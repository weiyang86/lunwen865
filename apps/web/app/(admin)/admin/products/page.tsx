'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Package, Plus, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { fetchProductDetail, updateProduct, uploadProductCover } from '@/services/admin/products';

export default function ProductsPage() {
  const categories = useCategoryTree();
  const products = useProductList();

  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [createCode, setCreateCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createCoverUrl, setCreateCoverUrl] = useState('');
  const [createCoverUploading, setCreateCoverUploading] = useState(false);
  const [createPriceYuan, setCreatePriceYuan] = useState('');
  const [createOriginalPriceYuan, setCreateOriginalPriceYuan] = useState('');
  const [createBrainCellAmount, setCreateBrainCellAmount] = useState('');
  const [createPaperQuota, setCreatePaperQuota] = useState('');
  const [createPolishQuota, setCreatePolishQuota] = useState('');
  const [createExportQuota, setCreateExportQuota] = useState('');
  const [createAiChatQuota, setCreateAiChatQuota] = useState('');
  const [createSortOrder, setCreateSortOrder] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ProductConfirmAction | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editCoverUploading, setEditCoverUploading] = useState(false);
  const [editPriceYuan, setEditPriceYuan] = useState('');
  const [editOriginalPriceYuan, setEditOriginalPriceYuan] = useState('');
  const [editBrainCellAmount, setEditBrainCellAmount] = useState('');
  const [editPaperQuota, setEditPaperQuota] = useState('');
  const [editPolishQuota, setEditPolishQuota] = useState('');
  const [editExportQuota, setEditExportQuota] = useState('');
  const [editAiChatQuota, setEditAiChatQuota] = useState('');
  const [editSortOrder, setEditSortOrder] = useState('');

  const createCoverFileRef = useRef<HTMLInputElement | null>(null);
  const editCoverFileRef = useRef<HTMLInputElement | null>(null);

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

  function resetCreateForm() {
    setCreateError(null);
    setCreateCode('');
    setCreateName('');
    setCreateDescription('');
    setCreateCoverUrl('');
    setCreatePriceYuan('');
    setCreateOriginalPriceYuan('');
    setCreateBrainCellAmount('');
    setCreatePaperQuota('');
    setCreatePolishQuota('');
    setCreateExportQuota('');
    setCreateAiChatQuota('');
    setCreateSortOrder('');
  }

  function resetEditForm() {
    setEditError(null);
    setEditId(null);
    setEditCode('');
    setEditName('');
    setEditDescription('');
    setEditCoverUrl('');
    setEditPriceYuan('');
    setEditOriginalPriceYuan('');
    setEditBrainCellAmount('');
    setEditPaperQuota('');
    setEditPolishQuota('');
    setEditExportQuota('');
    setEditAiChatQuota('');
    setEditSortOrder('');
  }

  function yuanToCents(raw: string): number | null {
    const v = raw.trim();
    if (!v) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
    const [intPart, fracPart = ''] = v.split('.');
    const cents =
      Number(intPart) * 100 + Number((fracPart + '00').slice(0, 2));
    if (!Number.isFinite(cents)) return null;
    return Math.trunc(cents);
  }

  function parseNonNegativeInt(raw: string): number | null {
    const v = raw.trim();
    if (!v) return null;
    if (!/^\d+$/.test(v)) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
  }

  function stripHtml(raw: string) {
    return raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }

  function handleCreateProduct() {
    setCreateOpen(true);
    setCreateError(null);
  }

  function handleEditProduct(id: string) {
    setEditOpen(true);
    setEditError(null);
    setEditLoading(true);
    setEditId(id);
    void (async () => {
      try {
        const p = await fetchProductDetail(id);
        setEditCode(p.code);
        setEditName(p.name);
        setEditDescription(p.description ?? '');
        setEditCoverUrl(p.coverUrl ?? '');
        setEditPriceYuan(String((p.priceCents ?? 0) / 100));
        setEditOriginalPriceYuan(
          p.originalPriceCents ? String(p.originalPriceCents / 100) : '',
        );
        setEditBrainCellAmount(String(p.brainCellAmount ?? 0));
        setEditPaperQuota(String(p.paperQuota ?? 0));
        setEditPolishQuota(String(p.polishQuota ?? 0));
        setEditExportQuota(String(p.exportQuota ?? 0));
        setEditAiChatQuota(String(p.aiChatQuota ?? 0));
        setEditSortOrder(String(p.sortOrder ?? 0));
      } catch (e: unknown) {
        const msg =
          e && typeof e === 'object' && 'message' in e
            ? String((e as any).message)
            : '加载失败';
        setEditError(msg);
      } finally {
        setEditLoading(false);
      }
    })();
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

  async function uploadCover(kind: 'create' | 'edit', file: File) {
    try {
      if (kind === 'create') setCreateCoverUploading(true);
      else setEditCoverUploading(true);
      const r = await uploadProductCover(file);
      if (kind === 'create') setCreateCoverUrl(r.url);
      else setEditCoverUrl(r.url);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : '上传失败';
      toast.error(msg);
    } finally {
      if (kind === 'create') setCreateCoverUploading(false);
      else setEditCoverUploading(false);
    }
  }

  async function submitCreate() {
    if (createSubmitting) return;
    const code = createCode.trim();
    const name = createName.trim();
    const coverUrl = createCoverUrl.trim();
    const richText = createDescription.trim();
    if (!code) {
      setCreateError('请输入商品 code');
      return;
    }
    if (!/^[A-Za-z0-9_]+$/.test(code)) {
      setCreateError('商品 code 只能包含英文、数字、下划线');
      return;
    }
    if (code.length > 50) {
      setCreateError('商品 code 最多 50 个字符');
      return;
    }
    if (!name) {
      setCreateError('请输入商品名称');
      return;
    }
    if (name.length > 100) {
      setCreateError('商品名称最多 100 个字符');
      return;
    }
    if (!coverUrl) {
      setCreateError('请上传或填写商品缩略图');
      return;
    }
    if (!stripHtml(richText)) {
      setCreateError('请输入商品简介');
      return;
    }

    const priceCents = yuanToCents(createPriceYuan);
    if (!priceCents || priceCents <= 0) {
      setCreateError('请输入价格（元），最多两位小数');
      return;
    }

    const originalPriceCents = createOriginalPriceYuan.trim()
      ? yuanToCents(createOriginalPriceYuan)
      : null;
    if (createOriginalPriceYuan.trim() && (!originalPriceCents || originalPriceCents <= 0)) {
      setCreateError('原价不合法（元），最多两位小数');
      return;
    }

    const paperQuota = parseNonNegativeInt(createPaperQuota);
    if (createPaperQuota.trim() && paperQuota === null) {
      setCreateError('论文生成配额必须为非负整数');
      return;
    }
    const brainCellAmount = parseNonNegativeInt(createBrainCellAmount);
    if (createBrainCellAmount.trim() && brainCellAmount === null) {
      setCreateError('脑细胞数量必须为非负整数');
      return;
    }
    const polishQuota = parseNonNegativeInt(createPolishQuota);
    if (createPolishQuota.trim() && polishQuota === null) {
      setCreateError('润色配额必须为非负整数');
      return;
    }
    const exportQuota = parseNonNegativeInt(createExportQuota);
    if (createExportQuota.trim() && exportQuota === null) {
      setCreateError('导出配额必须为非负整数');
      return;
    }
    const aiChatQuota = parseNonNegativeInt(createAiChatQuota);
    if (createAiChatQuota.trim() && aiChatQuota === null) {
      setCreateError('AI 对话配额必须为非负整数');
      return;
    }
    const sortOrder = parseNonNegativeInt(createSortOrder);
    if (createSortOrder.trim() && sortOrder === null) {
      setCreateError('排序必须为非负整数');
      return;
    }

    try {
      setCreateSubmitting(true);
      setCreateError(null);
      await products.createOne({
        code,
        name,
        description: richText,
        coverUrl,
        categoryId: categories.selectedId ?? undefined,
        priceCents,
        originalPriceCents: originalPriceCents ?? undefined,
        brainCellAmount: brainCellAmount ?? undefined,
        paperQuota: paperQuota ?? undefined,
        polishQuota: polishQuota ?? undefined,
        exportQuota: exportQuota ?? undefined,
        aiChatQuota: aiChatQuota ?? undefined,
        sortOrder: sortOrder ?? undefined,
      });
      setCreateOpen(false);
      resetCreateForm();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as any).message) : '创建失败';
      setCreateError(msg);
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function submitEdit() {
    if (editSubmitting || editLoading) return;
    if (!editId) return;
    const code = editCode.trim();
    const name = editName.trim();
    const coverUrl = editCoverUrl.trim();
    const richText = editDescription.trim();
    if (!code) {
      setEditError('请输入商品 code');
      return;
    }
    if (!/^[A-Za-z0-9_]+$/.test(code)) {
      setEditError('商品 code 只能包含英文、数字、下划线');
      return;
    }
    if (code.length > 50) {
      setEditError('商品 code 最多 50 个字符');
      return;
    }
    if (!name) {
      setEditError('请输入商品名称');
      return;
    }
    if (name.length > 100) {
      setEditError('商品名称最多 100 个字符');
      return;
    }
    if (!coverUrl) {
      setEditError('请上传或填写商品缩略图');
      return;
    }
    if (!stripHtml(richText)) {
      setEditError('请输入商品简介');
      return;
    }

    const priceCents = yuanToCents(editPriceYuan);
    if (!priceCents || priceCents <= 0) {
      setEditError('请输入价格（元），最多两位小数');
      return;
    }

    const originalPriceCents = editOriginalPriceYuan.trim()
      ? yuanToCents(editOriginalPriceYuan)
      : null;
    if (editOriginalPriceYuan.trim() && (!originalPriceCents || originalPriceCents <= 0)) {
      setEditError('原价不合法（元），最多两位小数');
      return;
    }

    const paperQuota = parseNonNegativeInt(editPaperQuota);
    if (editPaperQuota.trim() && paperQuota === null) {
      setEditError('论文生成配额必须为非负整数');
      return;
    }
    const brainCellAmount = parseNonNegativeInt(editBrainCellAmount);
    if (editBrainCellAmount.trim() && brainCellAmount === null) {
      setEditError('脑细胞数量必须为非负整数');
      return;
    }
    const polishQuota = parseNonNegativeInt(editPolishQuota);
    if (editPolishQuota.trim() && polishQuota === null) {
      setEditError('润色配额必须为非负整数');
      return;
    }
    const exportQuota = parseNonNegativeInt(editExportQuota);
    if (editExportQuota.trim() && exportQuota === null) {
      setEditError('导出配额必须为非负整数');
      return;
    }
    const aiChatQuota = parseNonNegativeInt(editAiChatQuota);
    if (editAiChatQuota.trim() && aiChatQuota === null) {
      setEditError('AI 对话配额必须为非负整数');
      return;
    }
    const sortOrder = parseNonNegativeInt(editSortOrder);
    if (editSortOrder.trim() && sortOrder === null) {
      setEditError('排序必须为非负整数');
      return;
    }

    try {
      setEditSubmitting(true);
      setEditError(null);
      await updateProduct(editId, {
        code,
        name,
        description: richText,
        coverUrl,
        categoryId: categories.selectedId ?? undefined,
        priceCents,
        originalPriceCents: originalPriceCents ?? undefined,
        brainCellAmount: brainCellAmount ?? undefined,
        paperQuota: paperQuota ?? undefined,
        polishQuota: polishQuota ?? undefined,
        exportQuota: exportQuota ?? undefined,
        aiChatQuota: aiChatQuota ?? undefined,
        sortOrder: sortOrder ?? undefined,
      });
      toast.success('已保存');
      setEditOpen(false);
      resetEditForm();
      await products.refresh();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : '保存失败';
      setEditError(msg);
    } finally {
      setEditSubmitting(false);
    }
  }

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

      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          if (createSubmitting) return;
          setCreateOpen(v);
          if (!v) resetCreateForm();
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>新增商品</DialogTitle>
            <DialogDescription>
              新增后默认上架（ON_SALE），库存默认为 0。若已选中分类，将自动写入商品分类。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>商品缩略图</Label>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                    {createCoverUrl ? (
                      <img
                        src={createCoverUrl}
                        alt="cover"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={createCoverFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        void uploadCover('create', f);
                      }}
                      disabled={createCoverUploading || createSubmitting}
                    />
                    <Button
                      variant="outline"
                      onClick={() => createCoverFileRef.current?.click()}
                      disabled={createCoverUploading || createSubmitting}
                    >
                      {createCoverUploading ? '上传中...' : '上传图片'}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-cover-url">图片 URL（可选）</Label>
                  <Input
                    id="create-cover-url"
                    value={createCoverUrl}
                    onChange={(e) => setCreateCoverUrl(e.target.value)}
                    placeholder="https://..."
                    disabled={createSubmitting}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>商品简介（富文本）</Label>
                <RichTextEditor
                  value={createDescription}
                  onChange={(v) => setCreateDescription(v)}
                  disabled={createSubmitting}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create-code">商品 code</Label>
              <Input
                id="create-code"
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value)}
                placeholder="例如: paper_basic"
                disabled={createSubmitting}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create-name">商品名称</Label>
              <Input
                id="create-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="例如: 本科论文生成（基础版）"
                disabled={createSubmitting}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="create-price">价格（元）</Label>
                <Input
                  id="create-price"
                  inputMode="decimal"
                  value={createPriceYuan}
                  onChange={(e) => setCreatePriceYuan(e.target.value)}
                  placeholder="例如: 199"
                  disabled={createSubmitting}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-original-price">原价（元，可选）</Label>
                <Input
                  id="create-original-price"
                  inputMode="decimal"
                  value={createOriginalPriceYuan}
                  onChange={(e) => setCreateOriginalPriceYuan(e.target.value)}
                  placeholder="例如: 299"
                  disabled={createSubmitting}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create-brain-cell">购买获得脑细胞（可选）</Label>
              <Input
                id="create-brain-cell"
                inputMode="numeric"
                value={createBrainCellAmount}
                onChange={(e) => setCreateBrainCellAmount(e.target.value)}
                placeholder="例如: 10"
                disabled={createSubmitting}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="create-paper-quota">论文生成配额（可选）</Label>
                <Input
                  id="create-paper-quota"
                  inputMode="numeric"
                  value={createPaperQuota}
                  onChange={(e) => setCreatePaperQuota(e.target.value)}
                  placeholder="例如: 1"
                  disabled={createSubmitting}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-polish-quota">润色配额（可选）</Label>
                <Input
                  id="create-polish-quota"
                  inputMode="numeric"
                  value={createPolishQuota}
                  onChange={(e) => setCreatePolishQuota(e.target.value)}
                  placeholder="例如: 2"
                  disabled={createSubmitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="create-export-quota">导出配额（可选）</Label>
                <Input
                  id="create-export-quota"
                  inputMode="numeric"
                  value={createExportQuota}
                  onChange={(e) => setCreateExportQuota(e.target.value)}
                  placeholder="例如: 1"
                  disabled={createSubmitting}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-ai-quota">AI 对话配额（可选）</Label>
                <Input
                  id="create-ai-quota"
                  inputMode="numeric"
                  value={createAiChatQuota}
                  onChange={(e) => setCreateAiChatQuota(e.target.value)}
                  placeholder="例如: 50"
                  disabled={createSubmitting}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create-sort">排序（可选，数字越小越靠前）</Label>
              <Input
                id="create-sort"
                inputMode="numeric"
                value={createSortOrder}
                onChange={(e) => setCreateSortOrder(e.target.value)}
                placeholder="例如: 0"
                disabled={createSubmitting}
              />
            </div>

            {createError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createSubmitting}
            >
              取消
            </Button>
            <Button onClick={submitCreate} disabled={createSubmitting}>
              {createSubmitting ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(v) => {
          if (editSubmitting) return;
          setEditOpen(v);
          if (!v) resetEditForm();
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>编辑商品</DialogTitle>
            <DialogDescription>
              修改将立即生效。若已选中分类，将自动写入商品分类。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>商品缩略图</Label>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                    {editCoverUrl ? (
                      <img
                        src={editCoverUrl}
                        alt="cover"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={editCoverFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        void uploadCover('edit', f);
                      }}
                      disabled={editCoverUploading || editSubmitting || editLoading}
                    />
                    <Button
                      variant="outline"
                      onClick={() => editCoverFileRef.current?.click()}
                      disabled={editCoverUploading || editSubmitting || editLoading}
                    >
                      {editCoverUploading ? '上传中...' : '上传图片'}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-cover-url">图片 URL（可选）</Label>
                  <Input
                    id="edit-cover-url"
                    value={editCoverUrl}
                    onChange={(e) => setEditCoverUrl(e.target.value)}
                    placeholder="https://..."
                    disabled={editSubmitting || editLoading}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>商品简介（富文本）</Label>
                <RichTextEditor
                  value={editDescription}
                  onChange={(v) => setEditDescription(v)}
                  disabled={editSubmitting || editLoading}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-code">商品 code</Label>
              <Input
                id="edit-code"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                disabled={editSubmitting || editLoading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-name">商品名称</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={editSubmitting || editLoading}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-price">价格（元）</Label>
                <Input
                  id="edit-price"
                  inputMode="decimal"
                  value={editPriceYuan}
                  onChange={(e) => setEditPriceYuan(e.target.value)}
                  disabled={editSubmitting || editLoading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-original-price">原价（元，可选）</Label>
                <Input
                  id="edit-original-price"
                  inputMode="decimal"
                  value={editOriginalPriceYuan}
                  onChange={(e) => setEditOriginalPriceYuan(e.target.value)}
                  disabled={editSubmitting || editLoading}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-brain-cell">购买获得脑细胞（可选）</Label>
              <Input
                id="edit-brain-cell"
                inputMode="numeric"
                value={editBrainCellAmount}
                onChange={(e) => setEditBrainCellAmount(e.target.value)}
                disabled={editSubmitting || editLoading}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-paper-quota">论文生成配额（可选）</Label>
                <Input
                  id="edit-paper-quota"
                  inputMode="numeric"
                  value={editPaperQuota}
                  onChange={(e) => setEditPaperQuota(e.target.value)}
                  disabled={editSubmitting || editLoading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-polish-quota">润色配额（可选）</Label>
                <Input
                  id="edit-polish-quota"
                  inputMode="numeric"
                  value={editPolishQuota}
                  onChange={(e) => setEditPolishQuota(e.target.value)}
                  disabled={editSubmitting || editLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-export-quota">导出配额（可选）</Label>
                <Input
                  id="edit-export-quota"
                  inputMode="numeric"
                  value={editExportQuota}
                  onChange={(e) => setEditExportQuota(e.target.value)}
                  disabled={editSubmitting || editLoading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-ai-quota">AI 对话配额（可选）</Label>
                <Input
                  id="edit-ai-quota"
                  inputMode="numeric"
                  value={editAiChatQuota}
                  onChange={(e) => setEditAiChatQuota(e.target.value)}
                  disabled={editSubmitting || editLoading}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-sort">排序（可选，数字越小越靠前）</Label>
              <Input
                id="edit-sort"
                inputMode="numeric"
                value={editSortOrder}
                onChange={(e) => setEditSortOrder(e.target.value)}
                disabled={editSubmitting || editLoading}
              />
            </div>

            {editLoading ? (
              <div className="text-sm text-slate-500">加载中...</div>
            ) : null}

            {editError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {editError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={editSubmitting}
            >
              取消
            </Button>
            <Button
              onClick={submitEdit}
              disabled={editSubmitting || editLoading}
            >
              {editSubmitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RichTextEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastValueRef = useRef<string>('');

  useEffect(() => {
    if (!ref.current) return;
    if (value === lastValueRef.current) return;
    ref.current.innerHTML = value || '';
    lastValueRef.current = value || '';
  }, [value]);

  function exec(cmd: string, arg?: string) {
    if (disabled) return;
    if (!ref.current) return;
    ref.current.focus();
    document.execCommand(cmd, false, arg);
    const html = ref.current.innerHTML;
    lastValueRef.current = html;
    onChange(html);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => exec('bold')}
          disabled={disabled}
        >
          加粗
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => exec('italic')}
          disabled={disabled}
        >
          斜体
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => exec('underline')}
          disabled={disabled}
        >
          下划线
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => exec('insertUnorderedList')}
          disabled={disabled}
        >
          无序列表
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => exec('insertOrderedList')}
          disabled={disabled}
        >
          有序列表
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const url = window.prompt('请输入链接地址');
            if (!url) return;
            exec('createLink', url);
          }}
          disabled={disabled}
        >
          插入链接
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => exec('removeFormat')}
          disabled={disabled}
        >
          清除样式
        </Button>
      </div>
      <div
        ref={ref}
        className="min-h-32 p-3 text-sm outline-none"
        contentEditable={!disabled}
        onInput={() => {
          if (!ref.current) return;
          const html = ref.current.innerHTML;
          lastValueRef.current = html;
          onChange(html);
        }}
        suppressContentEditableWarning
      />
    </div>
  );
}
