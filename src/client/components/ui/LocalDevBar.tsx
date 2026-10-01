import React, { useState } from 'react';
import { useLocalRecordStore } from '../../stores/useLocalRecordStore';
import { useToast } from './Toast';
import { IconUploadCloud, IconRefresh, IconChevronUp, IconChevronDown } from './Icons';
import { LocalMockImportModal } from './LocalMockImportModal';

export function LocalDevBar() {
  const { addToast } = useToast();
  const { records, resetToDefault, isLocalDev } = useLocalRecordStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isLocalDev) return null;

  return (
    <>
      <aside
        aria-label="Local development mock tools"
        className="fixed bottom-4 right-4 sm:right-6 z-40 max-w-[calc(100vw-2rem)] select-none animate-slide-up"
      >
        <div className="bg-card/90 backdrop-blur-xl border border-border/90 rounded-2xl shadow-float p-2.5 flex items-center gap-2 text-xs transition-all duration-200">
          {/* Status Indicator */}
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-2 px-2 py-1 rounded-xl text-left">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="font-mono font-bold text-[11px] text-foreground tracking-tight hidden sm:inline">
                Mock Mode ({records.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsMinimized((prev) => !prev)}
              className="p-1 rounded-lg hover:bg-muted/60 text-foreground/60 hover:text-foreground transition-colors"
              title="Toggle Dev Bar Minimization"
            >
              {isMinimized ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
            </button>
          </div>

          {!isMinimized && (
            <div className="flex items-center gap-1.5 pl-1 border-l border-border/70">
              {/* Open CSV Dropzone & Live List Modal */}
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="px-2.5 py-1.5 rounded-xl font-medium bg-muted/80 hover:bg-muted text-foreground transition-colors flex items-center gap-1.5 border border-border/60 touch-manipulation cursor-pointer"
                title="Open Local Dropzone & In-Memory Records List"
              >
                <IconUploadCloud size={13} />
                <span className="hidden sm:inline">Dropzone</span>
              </button>

              {/* Reset to Default */}
              <button
                type="button"
                onClick={() => {
                  resetToDefault();
                  addToast('Reset local store to initial 60 mock records', 'info');
                }}
                className="p-1.5 rounded-xl text-foreground/60 hover:text-foreground hover:bg-muted/80 transition-colors"
                title="Reset to default 60 records"
              >
                <IconRefresh size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <LocalMockImportModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
