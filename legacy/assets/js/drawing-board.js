saveButton.addEventListener('click', () => {
    const dataURL = canvas.toDataURL();
    const observation = drawingObservationTextarea.value.trim(); // Obtener el texto de la observación y eliminar espacios en blanco

    // --- Inicio de la validación ---
    const isCanvasBlank = (canvas) => {
        const blankCanvas = document.createElement('canvas');
        blankCanvas.width = canvas.width;
        blankCanvas.height = canvas.height;
        return canvas.toDataURL() === blankCanvas.toDataURL();
    };

    if (isCanvasBlank(canvas) && observation === '') {
        alert('Debes hacer un dibujo o añadir una observación antes de guardar.');
        return; // Detener la ejecución si ambas están vacías
    }
    // --- Fin de la validación ---

    console.log("Generated Data URL:", dataURL);
    const savedDrawings = JSON.parse(localStorage.getItem('drawings')) || [];

    // Guardar el dibujo y la observación como un objeto
    savedDrawings.push({ dataURL: dataURL, observation: observation });
    localStorage.setItem('drawings', JSON.stringify(savedDrawings));

    // Cargar y mostrar los dibujos guardados actualizados
    loadDrawings();
    // Limpiar el canvas y el cuadro de texto después de guardar
    drawingObservationTextarea.value = ''; // Limpiar el cuadro de texto de observación
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // history = []; // Opcional: Limpiar el historial del canvas después de guardar
    // saveState(); // Opcional: Guardar el estado inicial vacío en el historial
    alert('Dibujo guardado (temporalmente en tu navegador)!');
});