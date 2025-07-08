const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const brushSizeSlider = document.getElementById('brushSize');
const brushSizeValueSpan = document.getElementById('brushSizeValue'); // Obtener el span para mostrar el tamaño
const clearButton = document.getElementById('clearButton');
const saveButton = document.getElementById('saveButton');
const undoButton = document.getElementById('undoButton'); // Obtener el botón Deshacer

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let history = []; // Array para almacenar el historial del canvas (para Deshacer)

// Establecer el tamaño del canvas
canvas.width = canvas.parentElement.clientWidth;
canvas.height = 400;

ctx.lineJoin = 'round';
ctx.lineCap = 'round';
ctx.lineWidth = brushSizeSlider.value;
ctx.strokeStyle = colorPicker.value;

// Actualizar el valor del tamaño del pincel mostrado al inicio
brushSizeValueSpan.textContent = brushSizeSlider.value;


// Función para guardar el estado actual del canvas
function saveState() {
    history.push(canvas.toDataURL());
    // Opcional: Limitar el tamaño del historial para no consumir demasiada memoria
    // if (history.length > 20) {
    //     history.shift(); // Eliminar el estado más antiguo
    // }
}

// Función para restaurar el canvas a un estado anterior
function restoreState(state) {
    const img = new Image();
    img.onload = function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Limpiar el canvas actual
        ctx.drawImage(img, 0, 0); // Dibujar la imagen del estado anterior
    }
    img.src = state;
}


canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    [lastX, lastY] = [e.offsetX, e.offsetY];
});

canvas.addEventListener('mouseup', () => {
    if (isDrawing) { // Guardar el estado solo después de terminar un trazo
        saveState();
    }
    isDrawing = false;

});
canvas.addEventListener('mouseout', () => {
    if (isDrawing) { // Guardar el estado si el mouse sale del canvas mientras se dibuja
         saveState();
    }
    isDrawing = false;
});

// Evento para cambiar el color del pincel
colorPicker.addEventListener('input', (e) => {
    ctx.strokeStyle = e.target.value;
});

// Evento para cambiar el tamaño del pincel
brushSizeSlider.addEventListener('input', (e) => {
    ctx.lineWidth = e.target.value;
    brushSizeValueSpan.textContent = e.target.value; // Actualizar el valor mostrado
});

// Evento para borrar el canvas
clearButton.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    history = []; // Limpiar el historial al borrar
    saveState(); // Guardar el estado inicial vacío
});

// Evento para guardar el dibujo
saveButton.addEventListener('click', () => {
    const dataURL = canvas.toDataURL();

    const savedDrawings = JSON.parse(localStorage.getItem('drawings')) || [];
    savedDrawings.push(dataURL);
    localStorage.setItem('drawings', JSON.stringify(savedDrawings));

    alert('Dibujo guardado (temporalmente en tu navegador)!');
});

// Evento para Deshacer
undoButton.addEventListener('click', () => {
    if (history.length > 1) { // Necesitamos al menos dos estados para deshacer (el actual y el anterior)
        history.pop(); // Eliminar el estado actual
        const previousState = history[history.length - 1]; // Obtener el estado anterior
        restoreState(previousState); // Restaurar el canvas a ese estado
    } else if (history.length === 1) {
        // Si solo queda el estado inicial (canvas vacío), borrar el canvas
         ctx.clearRect(0, 0, canvas.width, canvas.height);
         history = []; // Limpiar el historial
         saveState(); // Guardar el estado inicial vacío
    }
});


// Opcional: Hacer el canvas responsivo (redimensionar al cambiar el tamaño de la ventana)
window.addEventListener('resize', () => {
    // Nota: Redimensionar borra el contenido del canvas.
    // Para preservar el dibujo, necesitarías redibujar el último estado guardado
    // o implementar una lógica de redibujo más sofisticada.
    const currentLineWidth = ctx.lineWidth;
    const currentStrokeStyle = ctx.strokeStyle;
     const currentState = canvas.toDataURL(); // Guardar el estado actual antes de redimensionar


    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 400;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = currentLineWidth;
    ctx.strokeStyle = currentStrokeStyle;

     // Restaurar el último estado después de redimensionar (esto puede causar pérdida de calidad)
     if (currentState) {
         restoreState(currentState);
     }
});

// Guardar el estado inicial del canvas (vacío) al cargar la página
saveState();
