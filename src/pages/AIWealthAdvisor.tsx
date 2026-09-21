import { Button } from '@/src/components/ui/button';
import { cn } from '@/lib/utils';
import { RiAddLine, RiSideBarLine } from 'react-icons/ri';
import { AdvisorChatPanel } from '@/src/features/ai-advisor/components/AdvisorChatPanel';
import { AdvisorHeader } from '@/src/features/ai-advisor/components/AdvisorHeader';
import { AdvisorSidebar } from '@/src/features/ai-advisor/components/AdvisorSidebar';
import { useAIAdvisor } from '@/src/features/ai-advisor/hooks/useAIAdvisor';

const dismissKeyboard = () => {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

export default function AIWealthAdvisor() {
  const advisor = useAIAdvisor();

  return (
    <div className="flex w-full flex-col gap-2 overflow-visible lg:h-full lg:min-h-0 lg:overflow-hidden">
      <AdvisorHeader
        messageCount={advisor.messages.length}
        clearMutation={advisor.clearMutation}
        summaryCards={advisor.summaryCards}
        showRecentChats={advisor.showRecentChats}
        onToggleRecentChats={() => advisor.setShowRecentChats((current) => !current)}
        onNewChat={() => advisor.newChatMutation.mutate()}
        newChatPending={advisor.newChatMutation.isPending}
      />

      <div className="flex items-center gap-2 pb-1 md:hidden shrink-0">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Show recent chats"
          title="Recent chats"
          onClick={() => {
            dismissKeyboard();
            advisor.setShowRecentChats(true);
          }}
        >
          <RiSideBarLine aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="New advisor chat"
          title="New chat"
          onClick={() => {
            dismissKeyboard();
            advisor.newChatMutation.mutate();
          }}
          disabled={advisor.newChatMutation.isPending}
        >
          <RiAddLine aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-1 gap-2 overflow-visible lg:min-h-0 lg:overflow-hidden">
        {advisor.showRecentChats ? (
          <div className="w-0 shrink-0 overflow-visible md:w-64 lg:flex lg:h-full lg:overflow-hidden">
            <AdvisorSidebar
              sessions={advisor.sessions}
              sessionId={advisor.sessionId}
              messageCount={advisor.messages.length}
              summaryCards={advisor.summaryCards}
              clearMutation={advisor.clearMutation}
              newChatMutation={advisor.newChatMutation}
              deleteChatMutation={advisor.deleteChatMutation}
              patchChatMutation={advisor.patchChatMutation}
              onHide={() => advisor.setShowRecentChats(false)}
              onSelectSession={advisor.selectSession}
            />
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 overflow-visible lg:h-full lg:overflow-hidden">
          <AdvisorChatPanel
            key={advisor.sessionId}
            messages={advisor.messages}
            introMessage={advisor.introMessage}
            isLoading={advisor.isLoading}
            loadError={advisor.messagesLoadError}
            sendMutation={advisor.sendMutation}
            onResponseComplete={advisor.refreshMessages}
            onRetryLoad={() => advisor.retryMessages()}
          />
        </div>
      </div>
    </div>
  );
}
