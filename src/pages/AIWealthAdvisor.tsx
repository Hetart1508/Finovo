import { Button } from '@/src/components/ui/button';
import { cn } from '@/lib/utils';
import { RiSideBarLine } from 'react-icons/ri';
import { AdvisorChatPanel } from '@/src/features/ai-advisor/components/AdvisorChatPanel';
import { AdvisorHeader } from '@/src/features/ai-advisor/components/AdvisorHeader';
import { AdvisorSidebar } from '@/src/features/ai-advisor/components/AdvisorSidebar';
import { useAIAdvisor } from '@/src/features/ai-advisor/hooks/useAIAdvisor';

export default function AIWealthAdvisor() {
  const advisor = useAIAdvisor();

  return (
    <div className="mx-auto flex h-[calc(100dvh-6.5rem)] max-w-6xl flex-col overflow-hidden md:grid md:h-full md:min-h-0 md:gap-3 md:grid-rows-[auto_auto_minmax(0,1fr)]">
      <AdvisorHeader
        messageCount={advisor.messages.length}
        clearMutation={advisor.clearMutation}
        summaryCards={advisor.summaryCards}
      />

      <div className={cn('grid min-h-0 flex-1 grid-cols-1 md:gap-3', advisor.showRecentChats ? 'md:grid-cols-[2.5rem_16rem_minmax(0,1fr)]' : 'md:grid-cols-[2.5rem_minmax(0,1fr)]')}>
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
          newChatMutation={advisor.newChatMutation}
          onRetryLoad={() => advisor.retryMessages()}
          onShowRecentChats={() => advisor.setShowRecentChats(true)}
        />
      </div>
    </div>
  );
}
