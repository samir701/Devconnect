'use client';

import React from 'react';
import { AppProvider } from '@/lib/store';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { ProjectInfoPanel } from '@/components/panels/ProjectInfoPanel';
import { GlobalSearchModal } from '@/components/modals/GlobalSearchModal';
import { CreateBugModal } from '@/components/modals/CreateBugModal';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
import { UserProfileModal } from '@/components/modals/UserProfileModal';
import { SystemStatusModal } from '@/components/modals/SystemStatusModal';
import { ProjectModal } from '@/components/modals/ProjectModal';
import { ProjectMembersModal } from '@/components/modals/ProjectMembersModal';
import { DeleteProjectModal } from '@/components/modals/DeleteProjectModal';
import { AuthModal } from '@/components/modals/AuthModal';
import { ConvertMessageModal } from '@/components/modals/ConvertMessageModal';
import { NotificationSettingsModal } from '@/components/modals/NotificationSettingsModal';
import { CallProvider } from '@/lib/callContext';
import { IncomingCallModal } from '@/components/call/IncomingCallModal';
import { ActiveCallModal } from '@/components/call/ActiveCallModal';
import { FloatingCallWidget } from '@/components/call/FloatingCallWidget';
import { useAppStore } from '@/lib/store';

function WorkspaceMain() {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    isCreateProjectOpen,
    setIsCreateProjectOpen,
    isProjectMembersOpen,
    setIsProjectMembersOpen,
    isConvertModalOpen,
    setIsConvertModalOpen,
    convertingMessage,
    setConvertingMessage,
  } = useAppStore();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090d16] font-sans antialiased text-slate-100">
      {/* Column 1: Left Navigation Sidebar */}
      <Sidebar />

      {/* Column 2: Center Conversation Area */}
      <ChatArea />

      {/* Column 3: Right Project Information Panel */}
      <ProjectInfoPanel />

      {/* Global Interactive Modals */}
      <GlobalSearchModal />
      <CreateBugModal />
      <CreateTaskModal />
      <ConvertMessageModal
        isOpen={isConvertModalOpen}
        message={convertingMessage}
        onClose={() => {
          setIsConvertModalOpen(false);
          setConvertingMessage(null);
        }}
      />
      <UserProfileModal />
      <SystemStatusModal />
      <ProjectModal isOpen={isCreateProjectOpen} onClose={() => setIsCreateProjectOpen(false)} />
      <ProjectMembersModal isOpen={isProjectMembersOpen} onClose={() => setIsProjectMembersOpen(false)} />
      <DeleteProjectModal />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      {/* Phase 6 – Notification Settings Modal */}
      <NotificationSettingsModal />

      {/* WebRTC Realtime Audio & Video Calling Components */}
      <IncomingCallModal />
      <ActiveCallModal />
      <FloatingCallWidget />
    </div>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <CallProvider>
        <WorkspaceMain />
      </CallProvider>
    </AppProvider>
  );
}

