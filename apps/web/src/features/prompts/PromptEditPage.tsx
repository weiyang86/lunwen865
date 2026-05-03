'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Tab } from '@headlessui/react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { promptApi } from '@/api/prompts';
import { DEFAULT_MODEL_CONFIG, type PromptDraft, type PromptVersion } from '@/types/prompt';
import { PromptEditorHeader } from './components/PromptEditorHeader';
import { PromptEditorPane } from './components/PromptEditorPane';
import { DiscardDraftDialog } from './components/DiscardDraftDialog';
import { PromptMetadataDialog } from './components/PromptMetadataDialog';
import { PromptModelPanel } from './components/PromptModelPanel';
import { SaveVersionDialog } from './components/SaveVersionDialog';
import { PromptVariablePanel } from './components/PromptVariablePanel';
import { PromptVersionDrawer } from './components/PromptVersionDrawer';
import { PromptTestPanel } from './components/test/PromptTestPanel';
import { usePromptEditor } from './hooks/usePromptEditor';
import { useExtractVariables } from './hooks/useExtractVariables';
import type { PromptVariable } from '@/types/prompt';

export function PromptEditPage({ id }: { id: string }) {
  const router = useRouter();

  const editor = usePromptEditor(id);
  const extract = useExtractVariables(editor.content, editor.variables);

  const [metadataOpen, setMetadataOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<PromptVersion | null>(null);
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testRunning, setTestRunning] = useState(false);

  const [testDraftSnapshot, setTestDraftSnapshot] = useState<PromptDraft>(() => ({
    templateId: id,
    content: editor.content,
    variables: editor.variables,
    modelConfig: editor.modelConfig,
    metadata: editor.metadata,
    updatedAt: editor.detail?.draft?.updatedAt ?? new Date().toISOString(),
  }));

  useEffect(() => {
    const t = window.setTimeout(() => {
      setTestDraftSnapshot({
        templateId: id,
        content: editor.content,
        variables: editor.variables,
        modelConfig: editor.modelConfig,
        metadata: editor.metadata,
        updatedAt: editor.detail?.draft?.updatedAt ?? new Date().toISOString(),
      });
    }, 600);
    return () => window.clearTimeout(t);
  }, [
    editor.content,
    editor.detail?.draft?.updatedAt,
    editor.metadata,
    editor.modelConfig,
    editor.variables,
    id,
  ]);

  const draftForDialog: PromptDraft = useMemo(
    () => ({
      templateId: id,
      content: editor.content,
      variables: editor.variables,
      modelConfig: editor.modelConfig,
      metadata: editor.metadata,
      updatedAt: editor.detail?.draft?.updatedAt ?? new Date().toISOString(),
    }),
    [editor.content, editor.detail?.draft?.updatedAt, editor.metadata, editor.modelConfig, editor.variables, id],
  );

  const baseForDialog: PromptVersion = useMemo(() => {
    if (editor.baseVersion) return editor.baseVersion;
    return {
      id: '',
      templateId: id,
      versionNo: 0,
      content: '',
      variables: [],
      modelConfig: DEFAULT_MODEL_CONFIG,
      metadata: {
        title: editor.detail?.name ?? '',
        description: editor.detail?.description ?? '',
        tags: editor.detail?.tags ?? [],
      },
      changelog: '',
      createdAt: '',
      createdBy: null,
    };
  }, [editor.baseVersion, editor.detail?.description, editor.detail?.name, editor.detail?.tags, id]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (editor.saveStatus === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editor.saveStatus]);

  if (editor.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Skeleton className="h-96 w-full lg:col-span-8" />
          <Skeleton className="h-48 w-full lg:col-span-4" />
        </div>
      </div>
    );
  }

  if (editor.error || !editor.detail) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-10 text-center">
        <div className="text-sm text-rose-700">模板不存在或已被删除</div>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={() => router.push('/admin/prompts')}>
            返回列表
          </Button>
          <Button variant="outline" onClick={editor.refresh}>
            重试
          </Button>
        </div>
      </div>
    );
  }

  function tabCls(selected: boolean) {
    return [
      'whitespace-nowrap px-4 py-2 text-sm -mb-px border-b-2 focus:outline-none',
      selected
        ? 'font-medium text-primary border-primary'
        : 'text-slate-500 hover:text-slate-700 border-transparent',
    ].join(' ');
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <PromptEditorHeader
        detail={editor.detail}
        saveStatus={editor.saveStatus}
        lastSavedAt={editor.lastSavedAt}
        onSaveRetry={() => void editor.saveNow()}
        onBack={async () => {
          if (editor.saveStatus === 'saving') await editor.saveNow();
          router.push('/admin/prompts');
        }}
        onOpenVersions={() => setVersionDrawerOpen(true)}
        onOpenMeta={() => setMetadataOpen(true)}
        onOpenDiscard={() => setDiscardOpen(true)}
        onSaveVersion={() => {
          setRollbackTarget(null);
          setSaveOpen(true);
        }}
        testOpen={testPanelOpen}
        testRunning={testRunning}
        onToggleTest={() => setTestPanelOpen((v) => !v)}
      />

      <div className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        <div className="flex-1">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <PromptEditorPane
                content={editor.content}
                onChange={editor.setContent}
                variables={editor.variables}
                onCreateVariable={(name) => {
                  if (editor.variables.some((v) => v.name === name)) return;
                  const next: PromptVariable = {
                    name,
                    label: name,
                    type: 'text',
                    required: true,
                    defaultValue: '',
                    description: '',
                  };
                  editor.setVariables([...editor.variables, next]);
                }}
              />
            </div>
            <div className="lg:col-span-4">
              <Tab.Group>
                <Tab.List className="mb-4 flex overflow-x-auto whitespace-nowrap border-b border-slate-200">
                  <Tab as={Fragment}>
                    {({ selected }: { selected: boolean }) => (
                      <button className={tabCls(selected)} type="button">
                        变量配置 ({editor.variables.length})
                        {extract.hasDiff ? (
                          <span className="ml-1 inline-block h-2 w-2 rounded-full bg-amber-500" />
                        ) : null}
                      </button>
                    )}
                  </Tab>
                  <Tab as={Fragment}>
                    {({ selected }: { selected: boolean }) => (
                      <button className={tabCls(selected)} type="button">
                        模型配置
                      </button>
                    )}
                  </Tab>
                </Tab.List>

                <Tab.Panels>
                  <Tab.Panel>
                    <PromptVariablePanel
                      variables={editor.variables}
                      onChange={editor.setVariables}
                      onUpdate={editor.updateVariable}
                      diff={extract.diff}
                      hasDiff={extract.hasDiff}
                      onSync={() => editor.setVariables(extract.syncToVariables())}
                    />
                  </Tab.Panel>
                  <Tab.Panel>
                    <PromptModelPanel value={editor.modelConfig} onChange={editor.setModelConfig} />
                  </Tab.Panel>
                </Tab.Panels>
              </Tab.Group>
            </div>
          </div>
        </div>

        <PromptTestPanel
          open={testPanelOpen}
          onClose={() => setTestPanelOpen(false)}
          promptId={id}
          baseVersionNo={editor.baseVersion?.versionNo ?? null}
          isDirty={editor.isDirty}
          draftSnapshot={testDraftSnapshot}
          onRunningChange={setTestRunning}
        />
      </div>

      <PromptMetadataDialog
        open={metadataOpen}
        initial={{
          title: editor.metadata.title,
          description: editor.metadata.description,
          tags: editor.metadata.tags,
        }}
        onClose={() => setMetadataOpen(false)}
        onSave={(next) => editor.updateMetadata(next)}
      />

      <DiscardDraftDialog
        open={discardOpen}
        hasDraft={editor.hasDraft}
        submitting={discarding}
        onClose={() => setDiscardOpen(false)}
        onConfirm={async () => {
          if (discarding) return;
          setDiscarding(true);
          try {
            await editor.discardDraft();
            toast.success('草稿已丢弃');
            setDiscardOpen(false);
          } finally {
            setDiscarding(false);
          }
        }}
      />

      <SaveVersionDialog
        open={saveOpen}
        draft={draftForDialog}
        baseVersion={baseForDialog}
        prefillFromVersion={rollbackTarget ?? undefined}
        onClose={() => {
          setSaveOpen(false);
          setRollbackTarget(null);
        }}
        onSubmit={async (commitMessage) => {
          if (editor.saveStatus === 'saving') await editor.saveNow();
          const src = rollbackTarget
            ? {
                content: rollbackTarget.content,
                variables: rollbackTarget.variables,
                modelConfig: rollbackTarget.modelConfig,
                metadata: rollbackTarget.metadata,
              }
            : {
                content: editor.content,
                variables: editor.variables,
                modelConfig: editor.modelConfig,
                metadata: editor.metadata,
              };
          const v = await promptApi.createVersion(id, { ...src, commitMessage });
          editor.applyNewVersion(v);
          setVersionDrawerOpen(false);
        }}
      />

      <PromptVersionDrawer
        open={versionDrawerOpen}
        promptId={id}
        baseVersion={editor.baseVersion}
        hasDraft={editor.hasDraft}
        onClose={() => setVersionDrawerOpen(false)}
        onSetBaseline={async (v) => {
          await promptApi.discardDraft(id).catch(() => null);
          editor.applyNewVersion(v);
          toast.success(`已切换到 v${v.versionNo} 为基线`);
          setVersionDrawerOpen(false);
        }}
        onRequestRollback={(v) => {
          setRollbackTarget(v);
          setSaveOpen(true);
        }}
      />
    </div>
  );
}
