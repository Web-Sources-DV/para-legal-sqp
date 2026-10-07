import { useEffect, useRef } from "react";
const dirtyForms = new Set<symbol>();
export function hasUnsavedChanges() {
  return dirtyForms.size > 0;
}
export function useUnsavedChanges(dirty: boolean) {
  const token = useRef(Symbol("form"));
  useEffect(() => {
    const id = token.current;
    if (dirty) dirtyForms.add(id);
    else dirtyForms.delete(id);
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      dirtyForms.delete(id);
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty]);
}
