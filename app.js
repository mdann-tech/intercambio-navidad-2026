const SUPABASE_URL = "https://xjrytobvfcmnmvepcuef.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8uEy2SicIlgTCJLA9pPtcw_GjObm4NU";
const INTERCAMBIO_ID = "5e702bf3-9b8d-4a5c-ae6d-d3b11bfc27d5";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

const app = document.getElementById("app");

const selector = document.getElementById("participante");
const campoPin = document.getElementById("pin");
const botonConfirmar = document.getElementById("confirmar-identidad");
const mensaje = document.getElementById("mensaje");

let participantes = [];
let participanteSeleccionado = null;
let destinatarioObtenido = null;

// Cargar participantes desde Supabase
async function cargarParticipantes() {
    try {
        mensaje.textContent = "Preparando el intercambio...";

        const { data, error } = await supabaseClient.rpc(
            "listar_participantes",
            {
                p_intercambio_id: INTERCAMBIO_ID
            }
        );

        if (error) throw error;

        participantes = data || [];

        selector.innerHTML = `
            <option value="">Selecciona tu nombre</option>
            ${participantes.map(p => `
                <option value="${p.id}">
                    ${escaparHTML(p.nombre)}
                </option>
            `).join("")}
        `;

    } catch (error) {
        console.error("Error al cargar participantes:", error);
        mensaje.textContent =
            "No se pudieron cargar los participantes. Intenta nuevamente.";
    }
}

// Evitar insertar nombres directamente como HTML
function escaparHTML(texto) {
    return String(texto).replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[caracter]);
}

// Validar selección y PIN
function validarAcceso() {
    const id = selector.value;
    const pin = campoPin.value.trim();

    participanteSeleccionado = participantes.find(
        p => p.id === id
    );

    botonConfirmar.disabled = !(
        participanteSeleccionado &&
        /^\d{4}$/.test(pin)
    );
}

selector.addEventListener("change", validarAcceso);

campoPin.addEventListener("input", () => {
    campoPin.value = campoPin.value.replace(/\D/g, "").slice(0, 4);
    validarAcceso();
});

// Primera confirmación: mostrar advertencia
botonConfirmar.addEventListener("click", () => {
    if (!participanteSeleccionado) return;

    const nombre = participanteSeleccionado.nombre;

    document.getElementById("acceso-participante").hidden = true;

    mensaje.innerHTML = `
        <div class="advertencia-confirmacion">
            <h2>Antes de continuar...</h2>

            <p>
                ¿Confirmas que eres
                <strong>${escaparHTML(nombre)}</strong>?
            </p>

            <p>
                Podrás volver a consultar tu resultado
                ingresando nuevamente tu nombre y PIN.
            </p>
            <p>
                Tu asignación no cambiará.
            </p>

            <button id="aceptar-consulta">
                Sí, confirmar mi identidad
            </button>

            <button id="cancelar-consulta" class="boton-cancelar">
                Regresar
            </button>
        </div>
    `;

    document.getElementById("aceptar-consulta")
        .addEventListener("click", confirmarConsulta);

    document.getElementById("cancelar-consulta")
        .addEventListener("click", () => {
            mensaje.innerHTML = "";
            document.getElementById("acceso-participante").hidden = false;
        });
});

// Segunda confirmación: consultar resultado una sola vez
async function confirmarConsulta() {
    const boton = document.getElementById("aceptar-consulta");

    boton.disabled = true;
    boton.textContent = "Verificando identidad...";

    const pin = campoPin.value.trim();

    try {
        const { data, error } = await supabaseClient.functions.invoke(
            "rapid-processor",
            {
                body: {
                    p_participante_id: participanteSeleccionado.id,
                    p_pin: pin
                }
            }
        );

        if (error) throw error;

        // Comprobar si el intercambio terminó
        if (data?.finalizado) {
            document.getElementById("acceso-participante").hidden = true;
            document.getElementById("zona-ruleta").hidden = true;
            document.getElementById("resultado").hidden = true;

            mensaje.textContent = data.message ||
                "¡Evento finalizado! Gracias por participar.";

            return;
        }

        if (!data || !data.success) {
            throw new Error(
                data?.message || "No se pudo consultar el resultado."
            );
        }

        destinatarioObtenido = data.destinatario;

        // Recuperar resultado anterior
        if (data.ya_consulto) {
            mostrarResultadoAnterior();
            return;
        }

        // Primera consulta: mostrar la ruleta
        mensaje.innerHTML = `
            <p>¡Identidad confirmada!</p>
            <p>Tu resultado está listo.</p>
        `;

        document.getElementById("zona-ruleta").hidden = false;
        document.getElementById("acceso-participante").hidden = true;

        iniciarPreparacionRuleta();

    } catch (error) {
        console.error("Error al consultar:", error);

        mensaje.textContent =
            error.message || "No se pudo completar la consulta.";

        boton.disabled = false;
        boton.textContent = "Sí, confirmar mi identidad";
    }
}


const canvas = document.getElementById("ruleta");
const contexto = canvas.getContext("2d");

const coloresRuleta = [
    "#173d32",
    "#792e3b",
    "#d5bd8b",
    "#285747",
    "#a34d59",
    "#eee1c5",
    "#244b3d",
    "#8c3948",
    "#c6a15b",
    "#35634f",
    "#6d2938"
];

function dibujarRuleta() {
    const cantidad = participantes.length;

    if (!cantidad) return;

    const tamaño = 800;
    const centro = tamaño / 2;
    const radio = 365;
    const angulo = (Math.PI * 2) / cantidad;

    canvas.width = tamaño;
    canvas.height = tamaño;

    contexto.clearRect(0, 0, tamaño, tamaño);

    for (let i = 0; i < cantidad; i++) {
        const inicio = -Math.PI / 2 + i * angulo;
        const fin = inicio + angulo;

        contexto.beginPath();
        contexto.moveTo(centro, centro);
        contexto.arc(centro, centro, radio, inicio, fin);
        contexto.closePath();

        contexto.fillStyle = coloresRuleta[i % coloresRuleta.length];
        contexto.fill();

        contexto.strokeStyle = "#c6a15b";
        contexto.lineWidth = 5;
        contexto.stroke();

        // Nombre del participante
        const medio = inicio + angulo / 2;
        const distancia = radio * 0.67;

        const x = centro + Math.cos(medio) * distancia;
        const y = centro + Math.sin(medio) * distancia;

        contexto.save();
        contexto.translate(x, y);
        contexto.rotate(medio + Math.PI / 2);

        contexto.fillStyle =
            coloresRuleta[i % coloresRuleta.length] === "#d5bd8b" ||
            coloresRuleta[i % coloresRuleta.length] === "#eee1c5" ||
            coloresRuleta[i % coloresRuleta.length] === "#c6a15b"
                ? "#173d32"
                : "#fffdf8";

        contexto.font = "bold 27px Arial";
        contexto.textAlign = "center";
        contexto.textBaseline = "middle";

        contexto.fillText(
            participantes[i].nombre,
            0,
            0,
            145
        );

        contexto.restore();
    }

    // Centro decorativo
    contexto.beginPath();
    contexto.arc(centro, centro, 48, 0, Math.PI * 2);
    contexto.fillStyle = "#f8f3e9";
    contexto.fill();

    contexto.lineWidth = 8;
    contexto.strokeStyle = "#c6a15b";
    contexto.stroke();

    contexto.fillStyle = "#173d32";
    contexto.font = "bold 35px Arial";
    contexto.textAlign = "center";
    contexto.textBaseline = "middle";
    contexto.fillText("✦", centro, centro);
}

function iniciarPreparacionRuleta() {
    dibujarRuleta();

    const botonRuleta = document.getElementById("girar-ruleta");

    botonRuleta.disabled = false;

    mensaje.textContent =
        "¡Todo listo! Ya puedes revelar tu resultado.";
}

async function iniciarPaginaPublica() {
    try {
        mensaje.textContent = "Preparando el intercambio...";

        const { data, error } = await supabaseClient.rpc(
            "consultar_estado_publico",
            {
                p_intercambio_id: INTERCAMBIO_ID
            }
        );

        if (error) throw error;

        if (!data) {
            throw new Error("No se encontró el intercambio.");
        }

        // Ocultar elementos de acceso mientras verificamos el estado
        document.getElementById("acceso-participante").hidden = true;
        document.getElementById("zona-ruleta").hidden = true;
        document.getElementById("resultado").hidden = true;

        // Comprobar si el evento terminó
        if (data.finalizado || data.estado === "finalizado") {
            let fechaFormateada = "";

            if (data.fecha_evento) {
                const [anio, mes, dia] = data.fecha_evento
                    .split("-")
                    .map(Number);

                fechaFormateada = new Date(
                    anio,
                    mes - 1,
                    dia
                ).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                });
            }

            mensaje.textContent = fechaFormateada
                ? `Evento finalizado el ${fechaFormateada}. ¡Gracias por participar!`
                : "¡Evento finalizado! Gracias por participar.";

            return;
        }

        // Comprobar si todavía está en borrador
        if (data.estado === "borrador") {
            mensaje.textContent =
                "El intercambio todavía no está disponible.";

            return;
        }

        // Comprobar si está pendiente de activación
        if (data.estado === "preparado") {
            mensaje.textContent =
                "El intercambio está pendiente de activación.";

            return;
        }

        // Mostrar acceso únicamente si está activo
        if (data.estado === "activo") {
            document.getElementById("acceso-participante").hidden = false;
            await cargarParticipantes();
            return;
        }

        mensaje.textContent =
            "No se puede acceder al intercambio en este momento.";

    } catch (error) {
        console.error("Error al iniciar la página:", error);

        mensaje.textContent =
            "No se pudo consultar el estado del intercambio. Intenta nuevamente.";
    }
}async function iniciarPaginaPublica() {
    try {
        mensaje.textContent = "Preparando el intercambio...";

        const { data, error } = await supabaseClient.rpc(
            "consultar_estado_publico",
            {
                p_intercambio_id: INTERCAMBIO_ID
            }
        );

        if (error) throw error;

        if (!data) {
            throw new Error("No se encontró el intercambio.");
        }

        // Ocultar elementos de acceso mientras verificamos el estado
        document.getElementById("acceso-participante").hidden = true;
        document.getElementById("zona-ruleta").hidden = true;
        document.getElementById("resultado").hidden = true;

        // Comprobar si el evento terminó
        if (data.finalizado || data.estado === "finalizado") {
            let fechaFormateada = "";

            if (data.fecha_evento) {
                const [anio, mes, dia] = data.fecha_evento
                    .split("-")
                    .map(Number);

                fechaFormateada = new Date(
                    anio,
                    mes - 1,
                    dia
                ).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                });
            }

            mensaje.textContent = fechaFormateada
                ? `Evento finalizado el ${fechaFormateada}. ¡Gracias por participar!`
                : "¡Evento finalizado! Gracias por participar.";

            return;
        }

        // Comprobar si todavía está en borrador
        if (data.estado === "borrador") {
            mensaje.textContent =
                "El intercambio todavía no está disponible.";

            return;
        }

        // Comprobar si está pendiente de activación
        if (data.estado === "preparado") {
            mensaje.textContent =
                "El intercambio está pendiente de activación.";

            return;
        }

        // Mostrar acceso únicamente si está activo
        if (data.estado === "activo") {
            document.getElementById("acceso-participante").hidden = false;
            await cargarParticipantes();
            return;
        }

        mensaje.textContent =
            "No se puede acceder al intercambio en este momento.";

    } catch (error) {
        console.error("Error al iniciar la página:", error);

        mensaje.textContent =
            "No se pudo consultar el estado del intercambio. Intenta nuevamente.";
    }
}

iniciarPaginaPublica();

let giroEnCurso = false;

const botonRuleta = document.getElementById("girar-ruleta");
const zonaResultado = document.getElementById("resultado");

function girarRuleta() {
    if (giroEnCurso || !destinatarioObtenido) return;

    const indice = participantes.findIndex(
        p => p.nombre === destinatarioObtenido
    );

    if (indice === -1) {
        mensaje.textContent = "No se pudo identificar el resultado.";
        return;
    }

    giroEnCurso = true;
    botonRuleta.disabled = true;
    botonRuleta.textContent = "¡Suerte!";

    const cantidad = participantes.length;
    const segmento = (Math.PI * 2) / cantidad;

    const centroSegmento =
        -Math.PI / 2 + (indice + 0.5) * segmento;

    let giroFinal =
        (-Math.PI / 2 - centroSegmento) % (Math.PI * 2);

    if (giroFinal < 0) {
        giroFinal += Math.PI * 2;
    }

    // Seis vueltas completas más el ajuste del destinatario
    const vueltas = Math.PI * 2 * 6;
    const rotacionTotal = vueltas + giroFinal;

    canvas.style.transition = "none";
    canvas.style.transform = "rotate(0rad)";

    // Permitir que el navegador registre la posición inicial
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            canvas.style.transition =
                "transform 6s cubic-bezier(0.12, 0.75, 0.15, 1)";

            canvas.style.transform =
                `rotate(${rotacionTotal}rad)`;
        });
    });

    canvas.addEventListener("transitionend", finalizarGiro, {
        once: true
    });
}

function finalizarGiro() {
    giroEnCurso = false;

    botonRuleta.hidden = true;

    zonaResultado.hidden = false;

    zonaResultado.innerHTML = `
        <p class="etiqueta-navidad">TU INTERCAMBIO DE NAVIDAD</p>
        <h2>¡Te tocó...!</h2>
        <p>La persona a quien le regalarás es:</p>
        <h1>${escaparHTML(destinatarioObtenido)}</h1>
        <p>¡Felices FIestas! ✨</p>
    `;

    mensaje.textContent = "Tu resultado quedó registrado.";
    crearLluviaEstrellas();
}

botonRuleta.addEventListener("click", girarRuleta);

function crearLluviaEstrellas() {
    const contenedor = document.querySelector(".pantalla-inicio");

    for (let i = 0; i < 90; i++) {
        const estrella = document.createElement("span");

        estrella.className = "estrella-caida";
        estrella.textContent = Math.random() > 0.5 ? "✦" : "✧";

        estrella.style.left = Math.random() * 100 + "%";
        estrella.style.animationDelay = Math.random() * 2.5 + "s";
        estrella.style.animationDuration =
            (3 + Math.random() * 2) + "s";

        estrella.style.fontSize =
            (12 + Math.random() * 15) + "px";

        contenedor.appendChild(estrella);

        estrella.addEventListener("animationend", () => {
            estrella.remove();
        });
    }
}

function mostrarResultadoAnterior() {
    // Ocultar completamente la ruleta
    document.getElementById("zona-ruleta").hidden = true;
    document.getElementById("acceso-participante").hidden = true;

    // Mostrar directamente el resultado
    zonaResultado.hidden = false;

    zonaResultado.innerHTML = `
        <p class="etiqueta-navidad">TU INTERCAMBIO DE NAVIDAD</p>
        <h2>¡Qué bueno verte de nuevo!</h2>
        <p>La persona a quien le regalarás es:</p>
        <h1>${escaparHTML(destinatarioObtenido)}</h1>
        <p>¡Felices Fiestas! ✨</p>
    `;

    mensaje.textContent = "";

    // Repetir el efecto decorativo
    crearLluviaEstrellas();
}
