import React from "react";
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section role="alert" className="bg-white p-6 rounded-xl">
        <p>
          No se pudo mostrar esta sección. Tus datos guardados permanecen en el
          servidor.
        </p>
        <button
          className="border rounded p-2 mt-3"
          onClick={() => this.setState({ failed: false })}
        >
          Reintentar sección
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}
