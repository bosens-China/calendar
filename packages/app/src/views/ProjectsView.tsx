import { QueryError } from '../components/ui/QueryError';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Edit2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CreateProjectRequest, Project, UpdateProjectRequest } from '@calendar/shared';
import { projectsApi } from '../api';
import { PROJECT_PALETTE } from '../utils/scheduleHelper';
import { Badge, Button, cn, FieldLabel, Input, Spinner, Textarea } from '../components/ui/primitives';

export const ProjectsView: React.FC = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Project | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROJECT_PALETTE[0]);
  const [description, setDescription] = useState('');

  const { data: projects = [], isLoading, isError, refetch } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: ({ signal }) => projectsApi.getProjects(signal),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['summary'] });
  };

  const createMutation = useMutation({
    mutationFn: (dto: CreateProjectRequest) => projectsApi.createProject(dto),
    onSuccess: () => {
      toast.success('项目已创建');
      setShowForm(false);
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateProjectRequest }) =>
      projectsApi.updateProject(id, dto),
    onSuccess: () => {
      toast.success('项目已更新');
      setShowForm(false);
      setEditing(null);
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : '更新失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.deleteProject(id),
    onSuccess: () => {
      toast.success('项目已删除');
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : '删除失败'),
  });

  const openCreate = () => {
    setEditing(null);
    setName('');
    setColor(PROJECT_PALETTE[projects.length % PROJECT_PALETTE.length]);
    setDescription('');
    setShowForm(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setName(p.name);
    setColor(p.color);
    setDescription(p.description || '');
    setShowForm(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('请输入项目名称');
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, dto: { name: name.trim(), color, description } });
    } else {
      createMutation.mutate({ name: name.trim(), color, description });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">共 {projects.length} 个项目</span>
        <Button size="sm" variant="primary" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          新建项目
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950 p-4 space-y-3"
        >
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            {editing ? `编辑项目：${editing.name}` : '新建项目'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel required>项目名称</FieldLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：核心研发" />
            </div>
            <div>
              <FieldLabel>项目标识色</FieldLabel>
              <div className="flex flex-wrap items-center gap-2 pt-1.5">
                {PROJECT_PALETTE.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setColor(hex)}
                    className={cn(
                      'h-5 w-5 rounded-full cursor-pointer transition-transform',
                      color === hex && 'ring-2 ring-slate-900 ring-offset-2 scale-110',
                    )}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div>
            <FieldLabel>项目说明</FieldLabel>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              取消
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              保存
            </Button>
          </div>
        </form>
      )}

      {isError && <QueryError message="无法加载项目" retry={() => void refetch()} />}
      {isLoading ? (
        <div className="py-10">
          <Spinner label="加载项目中..." />
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          {projects.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {p.name}
                    </span>
                    {p.archived ? (
                      <Badge tone="neutral">已归档</Badge>
                    ) : (
                      <Badge tone="green">进行中</Badge>
                    )}
                  </div>
                  {p.description && (
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {p.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="xs" variant="ghost" onClick={() => openEdit(p)}>
                  <Edit2 className="h-3.5 w-3.5" />
                  编辑
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => updateMutation.mutate({ id: p.id, dto: { archived: !p.archived } })}
                >
                  <Archive className="h-3.5 w-3.5" />
                  {p.archived ? '恢复' : '归档'}
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => {
                    if (window.confirm(`确定删除项目「${p.name}」吗？`)) {
                      deleteMutation.mutate(p.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
