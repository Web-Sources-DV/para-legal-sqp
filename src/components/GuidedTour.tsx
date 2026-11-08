import { useEffect, useRef, useState } from "react";
import type { ActiveTab } from "../types";

type Step = { target: string; title: string; text: string };
function visibleTarget(selector: string) {
  return [...document.querySelectorAll<HTMLElement>(selector)].find(
    (element) => element.getClientRects().length,
  );
}

const tools: Step[] = [
  {
    target: '[data-tour="tools"] > summary, [data-tour="desktop-tools-label"]',
    title: "Tus herramientas, en un solo menú",
    text: "Aquí encontrarás las funciones de administración. El tour las señala sin abrir fichas, modificar datos ni salir de tu trabajo.",
  },
  {
    target: "#nav-tab-clients",
    title: "Clientes",
    text: "Busca y edita identidades guardadas, consulta su historial o inicia otro documento con sus datos.",
  },
  {
    target: "#nav-tab-templates",
    title: "Plantillas",
    text: "Sube modelos Word con marcadores, elige el letrado y administra las plantillas que usarás al generar documentos.",
  },
  {
    target: "#nav-tab-history",
    title: "Historial",
    text: "Busca documentos ya generados y vuelve a descargar sus archivos. Los datos guardados se comparten entre los visitantes del enlace.",
  },
  {
    target: "#nav-tab-manual",
    title: "Ayuda",
    text: "Abre el manual completo para consultar instrucciones, formatos admitidos y respuestas a dudas frecuentes.",
  },
  {
    target: "#nav-tab-generator",
    title: "Generador avanzado",
    text: "Úsalo si ya tienes cliente y plantilla y quieres generar directamente. Para empezar con una foto, el flujo Documento es más sencillo.",
  },
];
const screens: Partial<Record<ActiveTab, Step[]>> = {
  wizard: [
    {
      target: "#btn-quick-new-doc",
      title: "Empieza un documento nuevo",
      text: "Este botón reinicia el asistente. Si tienes cambios sin guardar, la app te pedirá confirmación antes de descartarlos.",
    },
    {
      target: '[data-tour="progress"]',
      title: "Un documento en tres pasos",
      text: "Primero identifica al cliente, después revisa los datos y finalmente elige la plantilla para generar el Word.",
    },
    {
      target: '[data-tour="identity-modes"]',
      title: "Elige cómo identificar al cliente",
      text: "Lee una foto de su documento, recupera un cliente guardado o escribe los datos manualmente.",
    },
    {
      target: '[data-tour="client-picker"]',
      title: "Busca una identidad guardada",
      text: "Escribe el nombre o el número de identificación. Al elegir una ficha, podrás utilizar sus datos para preparar el documento.",
    },
    {
      target: '[data-tour="upload"]',
      title: "Sube una imagen nítida",
      text: "Selecciona o arrastra la foto completa. Después puedes girarla y pulsar Leer y revisar identidad. El OCR puede equivocarse: coteja siempre los datos con el original.",
    },
    {
      target: "#btn-read-identity",
      title: "Lee la imagen elegida",
      text: "Comprueba que la foto esté completa y derecha; puedes girarla antes de leerla. Este botón inicia el OCR y después muestra los datos para revisión.",
    },
    {
      target: "#tab-mode-camera",
      title: "También puedes usar la cámara",
      text: "Esta pestaña permite fotografiar el documento. El tour no activa tu cámara ni solicita permisos.",
    },
    {
      target: '[data-tour="ocr-options"] > summary',
      title: "Idioma y reverso",
      text: "Abre estas opciones cuando necesites otro idioma o añadir el reverso de la misma cédula. Las lecturas incompletas se revisan automáticamente con más contraste.",
    },
    {
      target: '[data-tour="review-fields"]',
      title: "Revisa la identidad",
      text: "Corrige nombre, número, país y fechas. La edad se calcula automáticamente; las alertas de vencimiento y las diferencias de lectura requieren tu atención.",
    },
    {
      target: '[data-tour="identity-confirmation"]',
      title: "Confirma tu revisión",
      text: "Marca esta casilla solo después de comparar la identidad con el documento original. Puedes guardar y continuar sin crear otro registro.",
    },
    {
      target: "#btn-save-client-only",
      title: "Guarda solo la ficha",
      text: "Usa esta opción si quieres registrar o actualizar al cliente sin preparar un Word todavía. La ficha queda disponible en el directorio compartido.",
    },
    {
      target: "#btn-confirm-and-generate",
      title: "Guarda y continúa",
      text: "Este botón guarda los datos revisados y te lleva a elegir la plantilla. El tour solo lo señala: no lo pulsa ni guarda nada.",
    },
    {
      target: '[data-tour="lawyer"]',
      title: "Selecciona el letrado",
      text: "Comprueba quién debe figurar como responsable del documento. Los campos asociados se completan con esa selección.",
    },
    {
      target: "#select-template-for-doc",
      title: "Elige tu plantilla",
      text: "Selecciona el modelo Word adecuado. Si no tienes ninguno, súbelo desde Herramientas → Plantillas.",
    },
    {
      target: '[data-tour="document-fields"]',
      title: "Completa el documento",
      text: "Revisa los campos rellenados y añade lo que falte. El apartado de firma es opcional; respeta el formato de tu plantilla.",
    },
    {
      target: '[data-tour="signature-options"]',
      title: "Firma opcional",
      text: "Abre este apartado solo si necesitas añadir o ajustar el bloque de firma. Puedes dejarlo desactivado para conservar la firma de tu plantilla.",
    },
    {
      target: "#btn-generate-word-docx",
      title: "Genera y descarga tu Word",
      text: "Este botón prepara el Word y lo archiva antes de descargarlo. Si falla el archivo, puedes reintentar conservando el mismo documento.",
    },
  ],
  clients: [
    {
      target: '[data-tour="client-search"]',
      title: "Encuentra un cliente",
      text: "Busca por nombre, identificación o correo. Abre su ficha para consultar sus datos y documentos.",
    },
    {
      target: "#btn-scan-new-client",
      title: "Registra con una foto",
      text: "Abre el lector para extraer y revisar los datos de una identidad nueva.",
    },
    {
      target: "#btn-manual-new-client",
      title: "Registro manual",
      text: "Crea una ficha sin fotografía. Revisa los campos antes de guardarla en el directorio compartido.",
    },
    {
      target: '[data-tour="client-list"] tbody tr:first-child td:last-child',
      title: "Ficha, documentos y edición",
      text: "En cada fila puedes consultar la ficha, generar un documento o editar los datos. Los controles para archivar requieren confirmación; el tour no los activa.",
    },
  ],
  templates: [
    {
      target: '[data-tour="template-lawyers"]',
      title: "Plantillas por letrado",
      text: "Estas pestañas permiten consultar los modelos del profesional seleccionado.",
    },
    {
      target: '[data-tour="template-upload"]',
      title: "Sube tu modelo Word",
      text: "El archivo debe ser un .docx válido y contener los marcadores que se rellenarán con los datos del cliente.",
    },
    {
      target: '[data-tour="template-list"]',
      title: "Administra y utiliza los modelos",
      text: "Consulta las plantillas disponibles y sus campos. Los controles de cada modelo permiten usarlo, descargarlo o administrarlo.",
    },
  ],
  history: [
    {
      target: '[data-tour="history-search"]',
      title: "Busca un documento",
      text: "Filtra por cliente, número de documento o plantilla para localizar un archivo ya generado.",
    },
    {
      target: '[data-tour="history-list"] tbody tr:first-child td:last-child',
      title: "Consulta y recupera archivos",
      text: "Los controles de cada fila permiten ver información y volver a descargar el Word. Archivar un registro requiere confirmación.",
    },
  ],
  generator: [
    {
      target: "#select-client-for-doc",
      title: "Selecciona al cliente",
      text: "Elige una identidad ya registrada. Para leer otra fotografía, usa Documento o el botón para subir un documento.",
    },
    {
      target: '[data-tour="lawyer"]',
      title: "Comprueba el letrado",
      text: "Esta selección determina los datos del profesional que figuran en los campos del documento.",
    },
    {
      target: "#select-template-for-doc",
      title: "Elige el modelo Word",
      text: "Selecciona una plantilla y revisa sus campos antes de descargar el resultado.",
    },
    {
      target: '[data-tour="document-fields"]',
      title: "Revisa y completa",
      text: "Puedes corregir los valores rellenados automáticamente. Las opciones de firma se encuentran plegadas debajo de los campos.",
    },
    {
      target: '[data-tour="signature-options"]',
      title: "Firma opcional",
      text: "Abre este apartado solo si necesitas añadir o ajustar el bloque de firma. Puedes dejarlo desactivado para conservar la firma de tu plantilla.",
    },
    {
      target: "#btn-generate-word-docx",
      title: "Genera, archiva y descarga",
      text: "El Word se prepara con tus correcciones. El tour no genera archivos ni realiza operaciones de guardado.",
    },
  ],
  manual: [
    {
      target: '[data-tour="manual"] h2',
      title: "Manual de uso",
      text: "Selecciona el tema que necesites: lectura de identidad, guardado, generación o gestión de plantillas. Puedes volver a abrir el tour desde la cabecera.",
    },
  ],
};

export function GuidedTour({ activeTab }: { activeTab: ActiveTab }) {
  const [mode, setMode] = useState<"choose" | "screen" | "tools" | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<{
    rect: DOMRect;
    left: number;
    top: number;
    below: boolean;
    arrow: number;
    maxHeight: number;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const restore = useRef({
    scroll: 0,
    menu: false,
    desktop: false,
    headerScroll: 0,
  });
  const step = steps[index];
  const open = mode !== null;

  const start = (kind: "screen" | "tools") => {
    const candidates = kind === "tools" ? tools : screens[activeTab] || [];
    const visible =
      kind === "tools"
        ? candidates
        : candidates.filter((item) => visibleTarget(item.target));
    setSteps(
      visible.length
        ? visible
        : [
            {
              target: "#nav-tab-wizard",
              title: "Continúa en Documento",
              text: "Esta pantalla todavía está cargando o no tiene controles disponibles. Puedes abrir el recorrido de herramientas o volver a intentarlo cuando termine de cargar.",
            },
          ],
    );
    setIndex(0);
    setLayout(null);
    setMode(kind);
  };
  const finish = () => {
    dialog.current?.close();
    setMode(null);
  };

  useEffect(() => {
    if (!open) return;
    const element = dialog.current!;
    const menu = document.querySelector<HTMLDetailsElement>(
      '[data-tour="tools"]',
    );
    restore.current = {
      scroll: window.scrollY,
      menu: !!menu?.open,
      desktop: window.matchMedia("(min-width: 1024px)").matches,
      headerScroll:
        document.querySelector<HTMLElement>(".workspace-header")?.scrollTop ||
        0,
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      const desktop = window.matchMedia("(min-width: 1024px)").matches;
      if (menu)
        menu.open =
          desktop ||
          (desktop === restore.current.desktop && restore.current.menu);
      document
        .querySelector<HTMLElement>(".workspace-header")
        ?.scrollTo({ top: restore.current.headerScroll, behavior: "instant" });
      window.scrollTo({ top: restore.current.scroll, behavior: "instant" });
    };
  }, [open]);

  useEffect(() => {
    if (!open || mode === "choose" || !step) {
      setLayout(null);
      return;
    }
    const menu = document.querySelector<HTMLDetailsElement>(
      '[data-tour="tools"]',
    );
    if (mode === "tools" && menu)
      menu.open =
        window.matchMedia("(min-width: 1024px)").matches ||
        index > 0 ||
        restore.current.menu;
    const target = visibleTarget(step.target);
    target?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
    const measure = () => {
      if (mode === "tools" && menu)
        menu.open =
          window.matchMedia("(min-width: 1024px)").matches ||
          index > 0 ||
          restore.current.menu;
      const target = visibleTarget(step.target);
      if (!target?.getClientRects().length) {
        setLayout(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      const width =
        card.current?.offsetWidth || Math.min(360, window.innerWidth - 32);
      const height =
        (card.current?.querySelector<HTMLElement>(".tour-body")?.scrollHeight ||
          120) +
        (card.current?.querySelector<HTMLElement>(".tour-footer")
          ?.offsetHeight || 96) +
        64;
      const belowSpace = window.innerHeight - rect.bottom - 36;
      const aboveSpace = rect.top - 36;
      const below = belowSpace >= height || belowSpace >= aboveSpace;
      const maxHeight = Math.min(
        window.innerHeight - 32,
        Math.max(100, below ? belowSpace : aboveSpace),
      );
      const left = Math.max(
        16,
        Math.min(
          rect.left + rect.width / 2 - width / 2,
          window.innerWidth - width - 16,
        ),
      );
      const top = Math.max(
        16,
        Math.min(
          below
            ? rect.bottom + 20
            : rect.top - Math.min(height, maxHeight) - 20,
          window.innerHeight - Math.min(height, maxHeight) - 16,
        ),
      );
      setLayout({
        rect,
        left,
        top,
        below,
        maxHeight,
        arrow: Math.max(
          20,
          Math.min(rect.left + rect.width / 2 - left, width - 20),
        ),
      });
    };
    measure();
    card.current
      ?.querySelector<HTMLButtonElement>(".tour-primary")
      ?.focus({ preventScroll: true });
    const observer = new ResizeObserver(measure);
    document
      .querySelectorAll(step.target)
      .forEach((element) => observer.observe(element));
    if (card.current) observer.observe(card.current);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, mode, step, index]);

  return (
    <>
      <button
        id="btn-guided-tour"
        type="button"
        onClick={() => setMode("choose")}
        className="rounded-xl border border-brand-300/70 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Tour guiado
      </button>
      <dialog
        ref={dialog}
        className="guided-tour"
        aria-label="Tour guiado de Para Legal"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const buttons = [
            ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ),
          ];
          const first = buttons[0],
            last = buttons.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onCancel={(event) => {
          event.preventDefault();
          finish();
        }}
        onClose={() => setMode(null)}
      >
        {open && (
          <>
            {layout ? (
              <div
                data-tour-highlight
                aria-hidden="true"
                className="tour-highlight"
                style={{
                  left: layout.rect.left - 5,
                  top: layout.rect.top - 5,
                  width: layout.rect.width + 10,
                  height: layout.rect.height + 10,
                }}
              />
            ) : (
              <div className="tour-shade" />
            )}
            <div
              ref={card}
              className={`tour-card${layout ? " tour-card-anchored" : ""}`}
              style={
                layout ? { left: layout.left, top: layout.top } : undefined
              }
            >
              {layout && (
                <span
                  aria-hidden="true"
                  className={`tour-arrow ${layout.below ? "tour-arrow-top" : "tour-arrow-bottom"}`}
                  style={{ left: layout.arrow }}
                />
              )}
              <div
                className="tour-card-content"
                style={layout ? { maxHeight: layout.maxHeight } : undefined}
              >
                {mode === "choose" ? (
                  <>
                    <div className="tour-body">
                      <p className="tour-eyebrow">TE ACOMPAÑAMOS</p>
                      <h2>Conoce Para Legal</h2>
                      <p>
                        Elige un recorrido corto. Señalaremos los controles sin
                        pulsarlos ni modificar tus datos.
                      </p>
                    </div>
                    <div className="tour-footer">
                      <button
                        className="tour-primary"
                        onClick={() => start("screen")}
                      >
                        Recorrer esta pantalla
                      </button>
                      <button
                        className="tour-secondary"
                        onClick={() => start("tools")}
                      >
                        Conocer las herramientas
                      </button>
                      <button className="tour-skip" onClick={finish}>
                        Ahora no
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="tour-body">
                      <p
                        className="tour-eyebrow"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        {mode === "tools" ? "HERRAMIENTAS" : "ESTA PANTALLA"} ·
                        PASO {index + 1} DE {steps.length}
                      </p>
                      <h2 aria-live="polite" aria-atomic="true">
                        {step?.title}
                      </h2>
                      <p>{step?.text}</p>
                      {!layout && (
                        <p className="tour-note">
                          Este control no está visible ahora. Puedes continuar
                          con el recorrido.
                        </p>
                      )}
                    </div>
                    <div className="tour-footer">
                      <div className="tour-actions">
                        <button
                          className="tour-secondary"
                          disabled={index === 0}
                          onClick={() => {
                            setLayout(null);
                            setIndex(index - 1);
                          }}
                        >
                          Anterior
                        </button>
                        <button
                          className="tour-primary"
                          onClick={() =>
                            index + 1 === steps.length
                              ? finish()
                              : (setLayout(null), setIndex(index + 1))
                          }
                        >
                          {index + 1 === steps.length
                            ? "Terminar"
                            : "Siguiente"}
                        </button>
                      </div>
                      <button className="tour-skip" onClick={finish}>
                        Salir del tour
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
