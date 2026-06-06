import { Component, type ErrorInfo, type ReactNode } from "react"

import type { TextDirection } from "../../config/i18n"

type ErrorBoundaryProps = {
  children: ReactNode
  description: string
  direction: TextDirection
  reloadLabel: string
  title: string
}

type ErrorBoundaryState = {
  hasError: boolean
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    if (__DEBUG__) {
      console.warn("FontAra UI render failed.", error, errorInfo)
    }
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          dir={this.props.direction}
          className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center text-gray-700">
          <h1 className="text-base font-bold text-gray-900">
            {this.props.title}
          </h1>
          <p className="text-sm leading-6">{this.props.description}</p>
          <button
            type="button"
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-[#2374ff] shadow-sm transition-colors hover:bg-gray-50"
            onClick={this.handleReload}>
            {this.props.reloadLabel}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
