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
    <div className="mx-auto flex h-[calc(100dvh-6.5rem)] w-full max-w-[100rem] flex-col overflow-hidden md:grid md:h-[calc(100dvh-10rem)] md:min-h-[34rem] md:gap-2 md:grid-rows-[auto_minmax(0,1fr)] xl:h-[calc(100dvh-11rem)]">
      <AdvisorHeader
        messageCount={advisor.messages.length}
        clearMutation={advisor.clearMutation}
        summaryCards={advisor.summaryCards}
      />

      <div className="flex items-center gap-2 pb-2 md:hidden">
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

      <div className={cn('grid min-h-0 flex-1 grid-cols-1 md:gap-2', advisor.showRecentChats ? 'md:grid-cols-[2.25rem_14rem_minmax(0,1fr)]' : 'md:grid-cols-[2.25rem_minmax(0,1fr)]')}>
        <div className="hidden min-h-0 justify-center md:flex">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={advisor.showRecentChats ? 'Hide recent chats' : 'Show recent chats'}
            title={advisor.showRecentChats ? 'Hide recent chats' : 'Show recent chats'}
            onClick={() => advisor.setShowRecentChats((current) => !current)}
          >
            <RiSideBarLine aria-hidden="true" />
          </Button>
        </div>

        {advisor.showRecentChats ? (
          <AdvisorSidebar
            sessions={advisor.sessions}
            sessionId={advisor.sessionId}
            messageCount={advisor.messages.length}
            summaryCards={advisor.summaryCards}
            clearMutation={advisor.clearMutation}
            newChatMutation={advisor.newChatMutation}
            deleteChatMutation={advisor.deleteChatMutation}
            onHide={() => advisor.setShowRecentChats(false)}
            onSelectSession={advisor.selectSession}
          />
        ) : null}

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
  );
}
