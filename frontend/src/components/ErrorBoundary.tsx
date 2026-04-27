import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; fallbackRoute?: string; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    // If a fallback route given, go there
    if (this.props.fallbackRoute) {
      window.location.hash = `#${this.props.fallbackRoute}`;
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center zamtel-gradient px-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-500 mb-1">The page crashed unexpectedly.</p>
            {this.state.error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleRetry}
              className="w-full bg-[#00843D] hover:bg-[#006B31] text-white font-bold py-3 rounded-xl transition-all"
            >
              Retry
            </button>
            <button
              onClick={() => { window.location.hash = '#/login'; }}
              className="w-full mt-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-all text-sm"
            >
              Back to Login
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
