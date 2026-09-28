import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';
import { IconAlertTriangle, IconRefreshCw } from './Icons';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('LifeOS ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[300px] w-full p-6 sm:p-10 flex items-center justify-center animate-fade-in">
          <div className="w-full max-w-lg bg-card/90 backdrop-blur-2xl border border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-float glass-inner text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 mx-auto flex items-center justify-center shadow-xs">
              <IconAlertTriangle size={28} />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                {this.props.fallbackTitle || 'Unable to display view'}
              </h2>
              <p className="text-xs sm:text-sm text-foreground/60 leading-relaxed max-w-md mx-auto">
                {this.props.fallbackMessage ||
                  'An unexpected error occurred while rendering this interface. Your data on the edge remains safe and intact.'}
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-muted/60 border border-border/80 rounded-xl text-left font-mono text-[11px] text-foreground/80 overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="w-full sm:w-auto justify-center"
              >
                <span>Try Again</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={this.handleReload}
                className="w-full sm:w-auto justify-center gap-1.5"
              >
                <IconRefreshCw size={14} />
                <span>Reload Application</span>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
