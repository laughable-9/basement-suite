// React error boundary — any uncaught render throw downstream becomes a
// visible error card instead of a blank window. The user can recover by
// clicking "Reload" instead of having to restart the dev server.

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to dev console so the stack is recoverable.
    // eslint-disable-next-line no-console
    console.error("Render error caught by ErrorBoundary:", error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="screen-center">
        <div className="error-card">
          <h1>Something broke</h1>
          <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
            {this.state.error.message}
          </p>
          <pre
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              overflowX: "auto",
              maxHeight: 200,
              margin: "10px 0 0",
            }}
          >
            {this.state.error.stack ?? ""}
          </pre>
          <div className="modal-actions" style={{ marginTop: 16 }}>
            <button
              className="player-btn modal-btn"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
            <button
              className="player-btn modal-btn primary"
              onClick={this.reset}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
