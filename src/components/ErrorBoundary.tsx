"use client";

import { Component, ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("[ErrorBoundary]", error, errorInfo.componentStack);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                    <div className="text-center max-w-sm">
                        <div className="text-4xl mb-4">😵</div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">
                            문제가 발생했어요
                        </h2>
                        <p className="text-sm text-gray-500 mb-6">
                            일시적인 오류가 발생했습니다. 다시 시도해주세요.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleRetry}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                다시 시도
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                새로고침
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
