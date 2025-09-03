const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const brushSizeSlider = document.getElementById('brushSize');
const brushSizeValueSpan = document.getElementById('brushSizeValue'); // Obtener el span para mostrar el tamaño
const clearButton = document.getElementById('clearButton');
const saveButton = document.getElementById('saveButton');
const drawingObservationTextarea = document.getElementById('drawingObservation'); // Obtener el cuadro de texto de observaciones
const undoButton = document.getElementById('undoButton'); // Obtener el botón Deshacer

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let history = []; // Array para almacenar el historial del canvas (para Deshacer)
const drawingsGallery = document.getElementById('drawings-gallery'); // Obtener el contenedor para los dibujos guardados

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
    saveState(); // Guardar el estado inicial vacío en el historial
});

// Evento para guardar el dibujo
const isCanvasBlank = (canvas) => {
    const blankCanvas = document.createElement('canvas');
    blankCanvas.width = canvas.width;
    blankCanvas.height = canvas.height;
    return canvas.toDataURL() === blankCanvas.toDataURL();
};




saveButton.addEventListener('click', () => {
    const dataURL = canvas.toDataURL();
    const observation = drawingObservationTextarea.value; // Obtener el texto de la observación

    console.log("Generated Data URL:", dataURL);
    const savedDrawings = JSON.parse(localStorage.getItem('drawings')) || [];
    
    // Validación: Asegurarse de que haya un dibujo o una observación
    if (isCanvasBlank(canvas) && observation.trim() === '') {
        alert('Debes hacer un dibujo o añadir una observación antes de guardar.');
        return; // Detener la ejecución si ambas están vacías
    }

    savedDrawings.push({ dataURL: dataURL, observation: observation });
    localStorage.setItem('drawings', JSON.stringify(savedDrawings));

    // Cargar y mostrar los dibujos guardados actualizados
    loadDrawings();
    // Limpiar el canvas y el cuadro de texto después de guardar
    drawingObservationTextarea.value = ''; // Limpiar el cuadro de texto de observación
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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

// Función para cargar y mostrar los dibujos guardados
// Función para cargar y mostrar los dibujos guardados
function loadDrawings() {
    const savedDrawings = JSON.parse(localStorage.getItem('drawings')) || [];
    drawingsGallery.innerHTML = ''; // Limpiar la galería antes de cargar

    savedDrawings.forEach((item, index) => {
        // Create card container with grid and margin classes
        const cardContainer = document.createElement('div');
        cardContainer.classList.add('col-md-4', 'mb-4'); // Bootstrap grid and margin
        cardContainer.dataset.index = index; // Add data attribute with index for deletion
        cardContainer.classList.add('card'); // Bootstrap card class

        const img = document.createElement('img');
        img.src = item.dataURL;
        img.alt = `Dibujo guardado ${index + 1}`;
        img.classList.add('img-fluid'); // Clases de Bootstrap para imagen responsiva

        // Create container for image and delete button for relative positioning
        const imageContainer = document.createElement('div');
        imageContainer.style.position = 'relative'; // Add relative positioning
        imageContainer.classList.add('card-img-top'); // Optional: Bootstrap class for top image
        imageContainer.appendChild(img); // Add image to image container

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'x';
        // Añadir evento para eliminar el dibujo
        deleteButton.addEventListener('click', () => {
            const currentDrawings = JSON.parse(localStorage.getItem('drawings')) || [];
            const drawingItemToDelete = deleteButton.parentElement.parentElement; // Get the parent card container
            // Eliminar el dibujo del array usando el índice
            const index = Array.from(drawingsGallery.children).indexOf(drawingItemToDelete);
            currentDrawings.splice(index, 1);
            // Guardar el array modificado de vuelta en localStorage
            localStorage.setItem('drawings', JSON.stringify(currentDrawings));
            // Volver a cargar la galería para actualizar la visualización
            loadDrawings();
        });

        // Add Bootstrap classes for delete button positioned absolutely
        deleteButton.classList.add('btn', 'btn-danger', 'btn-sm', 'position-absolute', 'top-0', 'end-0', 'm-2'); // Bootstrap positioning classes
        imageContainer.appendChild(deleteButton); // Add delete button to image container

        cardContainer.appendChild(imageContainer); // Add image container to card

        // Check if there is an observation
        if (item.observation && item.observation.trim() !== '') { // Check if observation exists and is not just whitespace
            const cardBody = document.createElement('div');
            cardBody.classList.add('card-body'); // Bootstrap card body class

            const observationBox = document.createElement('textarea');
            observationBox.classList.add('form-control', 'observation-box'); // Clases de Bootstrap para textarea
            observationBox.rows = 3;
            observationBox.value = item.observation.trim(); // Mostrar observación guardada, eliminando espacios en blanco al inicio/final
            observationBox.readOnly = true; // Hacer el textarea de observación de solo lectura en la galería
            observationBox.style.minHeight = '50px'; // Dar una altura mínima para que se vea el texto

            cardBody.appendChild(observationBox); // Add observation textarea to card body
            cardContainer.appendChild(cardBody); // Add card body to card

             // Add border and padding to the card container only if there's text
             cardContainer.style.border = '1px solid var(--secondary-color)';
             cardContainer.style.borderRadius = '5px';
             cardContainer.style.padding = '10px';
             cardContainer.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';

        } else {
            // If no observation, ensure there's no extra padding or border from the card body
            // We can add a class to the cardContainer to style it differently when there's no text
            cardContainer.classList.add('no-text');
            // Add border and padding directly to the image container for image-only items
             imageContainer.style.border = '1px solid var(--secondary-color)';
             imageContainer.style.borderRadius = '5px';
             imageContainer.style.padding = '10px';
             imageContainer.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
        }

        drawingsGallery.appendChild(cardContainer); // Add the whole card to the gallery
    });
}


// Cargar los dibujos guardados al cargar la página
document.addEventListener('DOMContentLoaded', loadDrawings);
