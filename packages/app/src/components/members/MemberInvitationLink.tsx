import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { InvitationLink } from '@calendar/shared';
import { Button, Input } from '../ui/primitives';

export function invitationUrl(token: string) {
  const url = new URL(window.location.pathname, window.location.origin);
  url.hash = new URLSearchParams({ invite: token }).toString();
  return url.href;
}

export function MemberInvitationLink({ invitation, onClose }: { invitation: InvitationLink; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const url = invitationUrl(invitation.token);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <section className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <label htmlFor="member-invite-link" className="text-sm font-semibold">邀请链接</label>
      <p className="text-xs text-zinc-500">把链接发给被邀请者。链接 48 小时内有效，只能使用一次。</p>
      <div className="flex gap-2">
        <Input id="member-invite-link" value={url} readOnly onFocus={event => event.target.select()} />
        <Button variant="outline" onClick={copyLink}>{copied ? <Check /> : <Copy />}{copied ? '已复制' : '复制链接'}</Button>
        <Button variant="ghost" onClick={onClose}>关闭</Button>
      </div>
      {copyFailed && <p role="alert" className="text-xs text-rose-600">请选中链接并手动复制。</p>}
    </section>
  );
}
