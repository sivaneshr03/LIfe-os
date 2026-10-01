import React, { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { IconUploadCloud, IconFileSpreadsheet, IconCheck, IconAlertTriangle } from './Icons';
import { useToast } from './Toast';

export interface CsvDropzoneProps {
  /**
   * TanStack Query mutation function or custom async pipeline.
   * Receives: { csvText: string, file: File, rowCount: number }
   */
  mutationFn?: (variables: { csvText: string; file: File; rowCount: number }) => Promise<unknown>;

  /**
   * If endpoint is specified instead of mutationFn, CsvDropzone performs a standard POST request
   * with JSON body { csvData: text, ...additionalPayload }.
   */
  endpoint?: string;

  /**
   * Optional custom request headers when posting to endpoint
   */
  headers?: Record<string, string>;

  /**
   * Additional payload fields merged into POST request (e.g. accountId, format)
   */
  additionalPayload?: Record<string, unknown>;

  /**
   * TanStack Query key(s) to automatically invalidate on success using queryClient.invalidateQueries
   */
  queryKeyToInvalidate?: QueryKey | QueryKey[];

  /**
   * Custom processing message shown during mutation isPending state.
   * Defaults to: "Importing records to Cloudflare D1..."
   */
  processingMessage?: string;

  /**
   * Dropzone headline. Defaults to: "Instant CSV Bulk Importer"
   */
  title?: string;

  /**
   * Dropzone description/subtitle. Defaults to: "Zero-click instant upload • Automatic parsing"
   */
  description?: string;

  /**
   * Expected columns or format hint to display to users
   */
  expectedFormatHint?: string;

  /**
   * Callback fired when mutation completes successfully
   */
  onSuccess?: (data: unknown, file: File) => void;

  /**
   * Callback fired when mutation encounters an error
   */
  onError?: (error: Error, file: File) => void;

  /**
   * Disable the dropzone interactions
   */
  disabled?: boolean;

  /**
   * Additional custom CSS classes for the container
   */
  className?: string;

  /**
   * Compact variant for tighter modal or drawer layouts
   */
  compact?: boolean;
}

interface FileMetadata {
  name: string;
  size: number;
  rowCount: number;
}

/**
 * Format bytes into human-readable string (KB, MB).
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Striking, zero-click interactive CSV Dropzone with automated TanStack Query mutation
 * and Cloudflare D1 state synchronization.
 */
export function CsvDropzone({
  mutationFn,
  endpoint,
  headers = {},
  additionalPayload = {},
  queryKeyToInvalidate,
  processingMessage = 'Importing records to Cloudflare D1...',
  title = 'Instant CSV Bulk Importer',
  description = 'Drag & drop your file or click to browse. Import triggers automatically on selection.',
  expectedFormatHint,
  onSuccess,
  onError,
  disabled = false,
  className = '',
  compact = false,
}: CsvDropzoneProps) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [activeFile, setActiveFile] = useState<FileMetadata | null>(null);
  const [lastSuccess, setLastSuccess] = useState<{ fileName: string; rowCount: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Counter to prevent child-element dragleave flickering
  const dragCounter = useRef(0);

  // TanStack Query Mutation: Automated Pipeline
  const mutation = useMutation<unknown, Error, { csvText: string; file: File; rowCount: number }>({
    mutationFn: async (variables) => {
      if (mutationFn) {
        return await mutationFn(variables);
      }

      if (endpoint) {
        const payload = {
          csvData: variables.csvText,
          ...additionalPayload,
        };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const errDetail =
            typeof json?.error === 'string'
              ? json.error
              : json?.error?.message || 'Server rejected CSV import payload';
          throw new Error(errDetail);
        }

        return json;
      }

      throw new Error('CsvDropzone requires either a mutationFn or an endpoint prop');
    },

    onSuccess: (data, variables) => {
      setLastSuccess({
        fileName: variables.file.name,
        rowCount: variables.rowCount,
      });
      setErrorMsg(null);

      // Cleanly invalidate TanStack Query cache tags to reload UI rows
      if (queryKeyToInvalidate) {
        if (Array.isArray(queryKeyToInvalidate) && Array.isArray(queryKeyToInvalidate[0])) {
          (queryKeyToInvalidate as QueryKey[]).forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        } else {
          queryClient.invalidateQueries({ queryKey: queryKeyToInvalidate as QueryKey });
        }
      }

      addToast(`Successfully imported ${variables.file.name} to Cloudflare D1`, 'success');
      onSuccess?.(data, variables.file);
    },

    onError: (err, variables) => {
      const message = err.message || 'CSV processing failed';
      setErrorMsg(message);
      addToast(message, 'error');
      onError?.(err, variables.file);
    },

    onSettled: () => {
      // REQUIREMENT: Completely flush and reset native HTML input value reference
      // so user can instantly upload modified or fresh files sequentially.
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
  });

  const isProcessing = mutation.isPending;
  const isInteractive = !disabled && !isProcessing;

  /**
   * Client-side automated processing pipeline:
   * Extracts file handle, reads via file.text(), and pipes directly into mutation.mutate().
   */
  const processFile = useCallback(
    async (file: File) => {
      if (!isInteractive) return;

      // Strictly validate .csv extension
      const fileNameLower = file.name.toLowerCase();
      if (!fileNameLower.endsWith('.csv')) {
        const errorText = 'Only .csv files are supported. Please provide a standard CSV file.';
        setErrorMsg(errorText);
        addToast(errorText, 'error');
        // Flush input reference immediately
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      setErrorMsg(null);
      setLastSuccess(null);

      try {
        // Asynchronous client-side file reading
        const text = await file.text();

        if (!text.trim()) {
          throw new Error('Selected CSV file is empty');
        }

        const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
        const rowCount = Math.max(0, lines.length - 1); // exclude header row estimate

        setActiveFile({
          name: file.name,
          size: file.size,
          rowCount,
        });

        // Zero-click automated piping into TanStack Query mutate() hook
        mutation.mutate({
          csvText: text,
          file,
          rowCount,
        });
      } catch (err: unknown) {
        const readErr = err instanceof Error ? err.message : 'Failed to parse file text';
        setErrorMsg(readErr);
        addToast(readErr, 'error');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [isInteractive, mutation, addToast]
  );

  // Native input onChange handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  // Drag and drop event handlers with dragCounter debounce
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isInteractive) return;
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isInteractive) return;
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isInteractive) return;
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOver(false);

    if (!isInteractive) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  // Click & keyboard handlers
  const handleContainerClick = () => {
    if (isInteractive && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && isInteractive) {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={clsx('w-full', className)}>
      {/* Hidden Native File Input restricted strictly to .csv format */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="sr-only"
        onChange={handleInputChange}
        disabled={!isInteractive}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Main Interactive Dropzone Box */}
      <div
        role="button"
        tabIndex={isInteractive ? 0 : -1}
        aria-disabled={!isInteractive}
        aria-busy={isProcessing}
        aria-label="Upload CSV file dropzone"
        onClick={handleContainerClick}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          'relative overflow-hidden group select-none transition-all duration-300 ease-out-expo',
          'rounded-2xl border-2 border-dashed',
          compact ? 'p-5' : 'p-8 sm:p-10',
          // Interactive state styling
          isInteractive && 'cursor-pointer hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5',
          !isInteractive && 'cursor-not-allowed opacity-90',
          // Dragging state styling
          isDraggingOver && [
            'border-primary bg-primary/10 scale-[1.01] shadow-xl shadow-primary/20',
            'ring-4 ring-primary/20',
          ],
          // Default idle background
          !isDraggingOver && !isProcessing && 'bg-card/75 backdrop-blur-md border-border/80 hover:bg-card/90',
          // Processing background
          isProcessing && 'bg-card/60 backdrop-blur-md border-primary/50'
        )}
      >
        {/* Subtle radial glow background effect */}
        <div
          aria-hidden="true"
          className={clsx(
            'absolute inset-0 pointer-events-none transition-opacity duration-500',
            'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent',
            isDraggingOver ? 'opacity-100' : 'opacity-40 group-hover:opacity-75'
          )}
        />

        {/* Shimmer overlay while processing */}
        {isProcessing && (
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-shimmer"
            style={{ backgroundSize: '200% 100%' }}
          />
        )}

        <div className="relative flex flex-col items-center justify-center text-center space-y-4">
          {/* ICON & BADGE ROW */}
          <div className="relative">
            {isProcessing ? (
              // Processing Spinner Ring with Pulsing Core
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                  <IconFileSpreadsheet size={16} className="text-primary" />
                </div>
              </div>
            ) : isDraggingOver ? (
              // Active Drag Drop Target State
              <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center scale-110 transition-transform duration-200">
                <IconUploadCloud size={28} className="animate-bounce" />
              </div>
            ) : lastSuccess ? (
              // Success Flash State
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shadow-sm">
                <IconCheck size={28} className="stroke-[2.5]" />
              </div>
            ) : (
              // Idle Default State
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs group-hover:scale-105 group-hover:bg-primary/15 group-hover:border-primary/30 transition-all duration-200">
                <IconUploadCloud size={28} className="stroke-[1.75]" />
              </div>
            )}

            {/* Zero-Click Tag badge */}
            {!isProcessing && (
              <span className="absolute -bottom-1 -right-2 px-1.5 py-0.5 text-[9px] font-mono font-bold tracking-wide uppercase bg-background border border-border text-foreground/70 rounded-md shadow-xs">
                .CSV
              </span>
            )}
          </div>

          {/* HEADLINE & DESCRIPTIONS */}
          <div className="space-y-1.5 max-w-md">
            {isProcessing ? (
              <>
                <div className="text-base sm:text-lg font-semibold text-foreground tracking-tight flex items-center justify-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-primary animate-ping" />
                  <span>{processingMessage}</span>
                </div>
                {activeFile && (
                  <p className="text-xs font-mono text-foreground/75 truncate max-w-sm mx-auto">
                    {activeFile.name} • {formatFileSize(activeFile.size)} ({activeFile.rowCount} rows)
                  </p>
                )}
              </>
            ) : isDraggingOver ? (
              <>
                <div className="text-base sm:text-lg font-bold text-primary tracking-tight">
                  Release to instantly import CSV
                </div>
                <p className="text-xs text-foreground/70">
                  Data will be validated and synced to database immediately
                </p>
              </>
            ) : (
              <>
                <div className="text-base sm:text-lg font-semibold text-foreground tracking-tight flex items-center justify-center gap-2">
                  <span>{title}</span>
                  <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Instant
                  </span>
                </div>
                <p className="text-xs text-foreground/60 leading-relaxed">
                  {description}
                </p>
              </>
            )}
          </div>

          {/* ACTIVE / LAST FILE PILL OR STATUS CARDS */}
          {lastSuccess && !isProcessing && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono animate-fade-in">
              <IconCheck size={14} />
              <span>
                Synced <strong className="font-semibold">{lastSuccess.fileName}</strong> ({lastSuccess.rowCount} records)
              </span>
              <span className="text-[10px] text-foreground/40 pl-1 border-l border-emerald-500/20">
                Ready for next file
              </span>
            </div>
          )}

          {errorMsg && !isProcessing && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs text-left max-w-md animate-fade-in">
              <IconAlertTriangle size={15} className="shrink-0" />
              <span className="truncate">{errorMsg}</span>
            </div>
          )}

          {/* EXPECTED FORMAT / HELP HINT */}
          {expectedFormatHint && !isProcessing && (
            <div className="pt-2 border-t border-border/50 text-[11px] font-mono text-foreground/50 max-w-md truncate">
              Columns: {expectedFormatHint}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
