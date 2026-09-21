import { useState, useMemo } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import type { AdvisorSession } from '@/src/api/aiAdvisorApi';
import { cn } from '@/lib/utils';
import {
  RiAddLine,
  RiArchiveLine,
  RiCheckLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiEditLine,
  RiMore2Fill,
  RiPushpin2Line,
  RiSearchLine,
  RiSparklingLine,
} from 'react-icons/ri';

type AdvisorSidebarProps = {
  sessions: AdvisorSession[];
  sessionId: string;
  messageCount: number;
  summaryCards: (string | number)[][];
  clearMutation: UseMutationResult<unknown, Error, void, unknown>;
  newChatMutation: UseMutationResult<AdvisorSession, Error, void, unknown>;
  deleteChatMutation: UseMutationResult<unknown, Error, string, unknown>;
  patchChatMutation: UseMutationResult<unknown, Error, { id: string; data: { title?: string; archived?: boolean; pinned?: boolean } }, unknown>;
  onHide: () => void;
  onSelectSession: (sessionId: string) => void;
};

const dismissKeyboard = () => {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

const getRelativeGroup = (dateStr?: string): 'Today' | 'Yesterday' | 'Previous 7 Days' | 'Older' => {
  if (!dateStr) return 'Older';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0 && date.getDate() === now.getDate()) return 'Today';
  if (diffDays <= 1) return 'Yesterday';
  if (diffDays <= 7) return 'Previous 7 Days';
  return 'Older';
};

export function AdvisorSidebar({
  sessions,
  sessionId,
  messageCount,
  summaryCards,
  clearMutation,
  newChatMutation,
  deleteChatMutation,
  patchChatMutation,
  onHide,
  onSelectSession,
}: AdvisorSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(null);
  const [deleteConfirmSessionId, setDeleteConfirmSessionId] = useState<string | null>(null);

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  const groupedSessions = useMemo(() => {
    const pinned: AdvisorSession[] = [];
    const today: AdvisorSession[] = [];
    const yesterday: AdvisorSession[] = [];
    const lastWeek: AdvisorSession[] = [];
    const older: AdvisorSession[] = [];

    for (const session of filteredSessions) {
      if (session.pinned) {
        pinned.push(session);
      } else {
        const group = getRelativeGroup(session.updated_at || session.created_at);
        if (group === 'Today') today.push(session);
        else if (group === 'Yesterday') yesterday.push(session);
        else if (group === 'Previous 7 Days') lastWeek.push(session);
        else older.push(session);
      }
    }

    return [
      { name: 'Pinned', items: pinned },
      { name: 'Today', items: today },
      { name: 'Yesterday', items: yesterday },
      { name: 'Previous 7 Days', items: lastWeek },
      { name: 'Older', items: older },
    ].filter((g) => g.items.length > 0);
  }, [filteredSessions]);

  const handleStartRename = (session: AdvisorSession) => {
    setEditingSessionId(session.session_id);
    setEditingTitle(session.title);
    setActiveMenuSessionId(null);
  };

  const handleSaveRename = (id: string) => {
    if (editingTitle.trim() && editingTitle.trim() !== sessions.find((s) => s.session_id === id)?.title) {
      patchChatMutation.mutate({ id, data: { title: editingTitle.trim() } });
    }
    setEditingSessionId(null);
  };

  const handleTogglePin = (session: AdvisorSession) => {
    patchChatMutation.mutate({ id: session.session_id, data: { pinned: !session.pinned } });
    setActiveMenuSessionId(null);
  };

  const handleConfirmDelete = (id: string) => {
    deleteChatMutation.mutate(id);
    setDeleteConfirmSessionId(null);
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-[#1F2937]/30 backdrop-blur-[1px] md:hidden"
        aria-label="Hide recent chats"
        onClick={onHide}
      />
      <Card className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,86vw)] min-h-0 flex-col rounded-none border-0 shadow-2xl md:static md:z-auto md:w-auto md:rounded-2xl md:border md:border-border/80 md:bg-card/95 md:shadow-md">
        <CardHeader className="shrink-0 space-y-3 border-b border-border/70 bg-gradient-to-br from-[#F7FBFF] to-card px-3 py-3 dark:from-blue-950/20">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <span className="flex size-6 items-center justify-center rounded-lg bg-[#EEF6FF] text-[#4F9CF9] dark:bg-blue-950/50">
                <RiSparklingLine className="size-3.5" aria-hidden="true" />
              </span>
              Conversations
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">{sessions.length}</span>
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="md:hidden text-muted-foreground hover:text-foreground"
                aria-label="Hide recent chats"
                onClick={onHide}
              >
                <RiCloseLine className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-8 gap-1 rounded-lg bg-[#4F9CF9] px-2.5 text-xs text-white shadow-sm hover:bg-[#3d8be8]"
                aria-label="New chat"
                title="New chat"
                onClick={() => {
                  dismissKeyboard();
                  if (!newChatMutation.isPending) newChatMutation.mutate();
                }}
                disabled={newChatMutation.isPending}
              >
                <RiAddLine className="size-4" aria-hidden="true" />
                <span className="font-medium">New Chat</span>
              </Button>
            </div>
          </div>

          {/* Search box */}
          <div className="relative">
            <RiSearchLine className="absolute left-3 top-3 size-3.5 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="h-9 w-full rounded-xl border border-border/70 bg-card/90 pl-9 pr-3 text-xs text-foreground shadow-xs placeholder:text-muted-foreground/80 transition focus:border-[#4F9CF9] focus:outline-none focus:ring-2 focus:ring-[#4F9CF9]/15"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <RiCloseLine className="size-4" />
              </button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-2 py-3">
          {/* Mobile summary cards */}
          <div className="grid grid-cols-2 gap-2 pb-3 md:hidden">
            {summaryCards.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border bg-muted/40 p-2">
                <p className="truncate text-[0.68rem] text-muted-foreground">{label}</p>
                <p className="truncate text-xs font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="mb-2 h-8 w-full justify-start gap-2 text-xs md:hidden"
            onClick={() => clearMutation.mutate()}
            disabled={!messageCount || clearMutation.isPending}
          >
            <RiDeleteBinLine className="size-3.5" aria-hidden="true" />
            Clear current chat
          </Button>

          {/* Grouped session list */}
          <div className="space-y-4">
            {groupedSessions.length ? (
              groupedSessions.map((group) => (
                <div key={group.name} className="space-y-1">
                  <h3 className="px-2 pb-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
                    {group.name}
                  </h3>
                  {group.items.map((session) => {
                    const isActive = session.session_id === sessionId;
                    const isEditing = editingSessionId === session.session_id;
                    const isMenuOpen = activeMenuSessionId === session.session_id;

                    if (isEditing) {
                      return (
                        <div key={session.session_id} className="flex items-center gap-1 px-1 py-1">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(session.session_id);
                              if (e.key === 'Escape') setEditingSessionId(null);
                            }}
                            autoFocus
                            className="h-7 min-w-0 flex-1 rounded border border-[#4F9CF9] bg-background px-2 text-xs text-foreground focus:outline-none"
                          />
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => handleSaveRename(session.session_id)}
                            className="text-emerald-500 hover:text-emerald-600"
                          >
                            <RiCheckLine className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => setEditingSessionId(null)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <RiCloseLine className="size-3.5" />
                          </Button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={session.session_id}
                        className={cn(
                          'group relative flex items-center rounded-xl border border-transparent px-2.5 py-2 transition-all duration-150',
                          isActive
                            ? 'border-[#4F9CF9]/15 bg-[#EEF6FF] font-medium text-[#1E3A8A] shadow-xs dark:bg-blue-950/40 dark:text-blue-200'
                            : 'text-muted-foreground hover:border-border/70 hover:bg-card hover:text-foreground hover:shadow-2xs'
                        )}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left text-xs font-medium leading-5"
                          onClick={() => {
                            dismissKeyboard();
                            onSelectSession(session.session_id);
                          }}
                          title={session.title}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            {session.pinned ? (
                              <RiPushpin2Line className="size-3 shrink-0 text-[#4F9CF9]" />
                            ) : null}
                            <span className="truncate">{session.title}</span>
                          </span>
                        </button>

                        <div className="relative shrink-0">
                          <button
                            type="button"
                            className="flex size-6 items-center justify-center rounded text-muted-foreground opacity-100 transition hover:bg-background hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuSessionId(isMenuOpen ? null : session.session_id);
                            }}
                            aria-label="Options"
                          >
                            <RiMore2Fill className="size-3.5" />
                          </button>

                          {/* Popover menu */}
                          {isMenuOpen ? (
                            <>
                              <button
                                type="button"
                                className="fixed inset-0 z-30 cursor-default"
                                onClick={() => setActiveMenuSessionId(null)}
                              />
                              <div className="absolute right-0 top-7 z-40 w-32 rounded-lg border border-border bg-popover p-1 text-xs text-popover-foreground shadow-lg">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted"
                                  onClick={() => handleStartRename(session)}
                                >
                                  <RiEditLine className="size-3.5 text-muted-foreground" />
                                  <span>Rename</span>
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted"
                                  onClick={() => handleTogglePin(session)}
                                >
                                  <RiPushpin2Line className="size-3.5 text-muted-foreground" />
                                  <span>{session.pinned ? 'Unpin' : 'Pin'}</span>
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted"
                                  onClick={() => {
                                    patchChatMutation.mutate({
                                      id: session.session_id,
                                      data: { archived: !session.archived_at },
                                    });
                                    setActiveMenuSessionId(null);
                                  }}
                                >
                                  <RiArchiveLine className="size-3.5 text-muted-foreground" />
                                  <span>{session.archived_at ? 'Unarchive' : 'Archive'}</span>
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setActiveMenuSessionId(null);
                                    setDeleteConfirmSessionId(session.session_id);
                                  }}
                                >
                                  <RiDeleteBinLine className="size-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                {searchQuery ? 'No matching conversations' : 'No recent chats yet.'}
              </div>
            )}
          </div>
        </CardContent>

        {/* Delete Confirmation Modal */}
        {deleteConfirmSessionId ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-xl">
              <h4 className="text-sm font-semibold text-foreground">Delete Conversation?</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                This will permanently delete this conversation history. This action cannot be undone.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDeleteConfirmSessionId(null)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => handleConfirmDelete(deleteConfirmSessionId)}
                  disabled={deleteChatMutation.isPending}
                  className="h-8 text-xs"
                >
                  Delete Chat
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Card>
    </>
  );
}
