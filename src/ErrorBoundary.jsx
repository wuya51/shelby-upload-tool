import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto mt-8">
          <h2 className="text-xl font-bold text-red-800 mb-4">Something went wrong</h2>
          <div className="bg-white rounded-lg p-4 mb-4">
            <p className="text-red-700 font-medium mb-2">Error:</p>
            <pre className="text-sm text-gray-800 bg-gray-50 p-2 rounded overflow-auto">
              {this.state.error && this.state.error.toString()}
            </pre>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-red-700 font-medium mb-2">Error Info:</p>
            <pre className="text-sm text-gray-800 bg-gray-50 p-2 rounded overflow-auto">
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </div>
          <button 
            className="mt-4 bg-red-100 hover:bg-red-200 text-red-800 font-medium py-2 px-4 rounded-md transition-colors duration-200"
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;