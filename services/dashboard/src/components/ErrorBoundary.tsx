"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Dashboard error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md text-center">
            <p className="text-4xl mb-4">💥</p>
            <h2 className="text-xl font-bold text-zinc-100 mb-2">Something went wrong</h2>
            <p className="text-zinc-400 text-sm mb-4">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-zinc-800 text-zinc-100 rounded-lg text-sm hover:bg-zinc-700 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
