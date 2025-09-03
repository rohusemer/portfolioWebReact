const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const brushSizeSlider = document.getElementById('brushSize');
const brushSizeValueSpan = document.getElementById('brushSizeValue');
const clearButton = document.getElementById('clearButton');
const saveButton = document.getElementById('saveButton');
const drawingObservationTextarea = document.getElementById('drawingObservation');
const undoButton = document.getElementById('undoButton');
const drawingsGallery = document.getElementById('drawings-gallery');
const pencilButton = document.getElementById('pencilButton');
const eraserButton = document.getElementById('eraserButton');

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let history = [];

if (canvas) {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 400;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = brushSizeSlider.value;
    ctx.strokeStyle = colorPicker.value;

    if(brushSizeValueSpan){
        brushSizeValueSpan.textContent = brushSizeSlider.value;
    }

    function saveState() {
        history.push(canvas.toDataURL());
    }

    function restoreState(state) {
        const img = new Image();
        img.onload = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
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
        if (isDrawing) {
            saveState();
        }
        isDrawing = false;
    });

    canvas.addEventListener('mouseout', () => {
        if (isDrawing) {
            saveState();
        }
        isDrawing = false;
    });

    if(colorPicker){
        colorPicker.addEventListener('input', (e) => {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = e.target.value;
        });
    }

    if(brushSizeSlider){
        brushSizeSlider.addEventListener('input', (e) => {
            ctx.lineWidth = e.target.value;
            brushSizeValueSpan.textContent = e.target.value;
        });
    }

    if(pencilButton) {
        pencilButton.addEventListener('click', () => {
            ctx.globalCompositeOperation = 'source-over';
        });
    }

    if(eraserButton) {
        eraserButton.addEventListener('click', () => {
            ctx.globalCompositeOperation = 'destination-out';
        });
    }

    if(clearButton){
        clearButton.addEventListener('click', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            history = [];
            saveState();
        });
    }

    const isCanvasBlank = (canvas) => {
        const blankCanvas = document.createElement('canvas');
        blankCanvas.width = canvas.width;
        blankCanvas.height = canvas.height;
        return canvas.toDataURL() === blankCanvas.toDataURL();
    };

    if(saveButton){
        saveButton.addEventListener('click', () => {
            const dataURL = canvas.toDataURL();
            const observation = drawingObservationTextarea.value;

            const savedDrawings = JSON.parse(localStorage.getItem('drawings')) || [];
            
            if (isCanvasBlank(canvas) && observation.trim() === '') {
                alert('Debes hacer un dibujo o añadir una observación antes de guardar.');
                return;
            }

            savedDrawings.push({ dataURL: dataURL, observation: observation });
            localStorage.setItem('drawings', JSON.stringify(savedDrawings));

            loadDrawings();
            drawingObservationTextarea.value = '';
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            alert('Dibujo guardado (temporalmente en tu navegador)!');
        });
    }

    if(undoButton){
        undoButton.addEventListener('click', () => {
            if (history.length > 1) {
                history.pop();
                const previousState = history[history.length - 1];
                restoreState(previousState);
            } else if (history.length === 1) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                history = [];
                saveState();
            }
        });
    }

    window.addEventListener('resize', () => {
        const currentLineWidth = ctx.lineWidth;
        const currentStrokeStyle = ctx.strokeStyle;
        const currentCompositeOperation = ctx.globalCompositeOperation;
        const currentState = canvas.toDataURL();

        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = 400;

        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = currentLineWidth;
        ctx.strokeStyle = currentStrokeStyle;
        ctx.globalCompositeOperation = currentCompositeOperation;

        if (currentState) {
            restoreState(currentState);
        }
    });

    saveState();

    function loadDrawings() {
        const savedDrawings = JSON.parse(localStorage.getItem('drawings')) || [];
        if(drawingsGallery){
            drawingsGallery.innerHTML = '';

            savedDrawings.forEach((item, index) => {
                const cardContainer = document.createElement('div');
                cardContainer.classList.add('w-full', 'md:w-1/2', 'lg:w-1/3', 'p-2');
                cardContainer.dataset.index = index;
                cardContainer.classList.add('bg-white', 'dark:bg-gray-800', 'shadow-lg', 'rounded-lg');

                const img = document.createElement('img');
                img.src = item.dataURL;
                img.alt = `Dibujo guardado ${index + 1}`;
                img.classList.add('w-full', 'h-auto');

                const imageContainer = document.createElement('div');
                imageContainer.style.position = 'relative';
                imageContainer.appendChild(img);

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'x';
                deleteButton.addEventListener('click', () => {
                    const currentDrawings = JSON.parse(localStorage.getItem('drawings')) || [];
                    const drawingItemToDelete = deleteButton.parentElement.parentElement;
                    const index = Array.from(drawingsGallery.children).indexOf(drawingItemToDelete);
                    currentDrawings.splice(index, 1);
                    localStorage.setItem('drawings', JSON.stringify(currentDrawings));
                    loadDrawings();
                });

                deleteButton.classList.add('bg-red-500', 'hover:bg-red-700', 'text-white', 'font-bold', 'py-1', 'px-2', 'rounded', 'absolute', 'top-2', 'right-2');
                imageContainer.appendChild(deleteButton);

                cardContainer.appendChild(imageContainer);

                if (item.observation && item.observation.trim() !== '') {
                    const cardBody = document.createElement('div');
                    cardBody.classList.add('p-4');

                    const observationBox = document.createElement('textarea');
                    observationBox.classList.add('w-full', 'p-2', 'border', 'border-gray-300', 'rounded-lg', 'bg-gray-100', 'dark:bg-gray-700');
                    observationBox.rows = 3;
                    observationBox.value = item.observation.trim();
                    observationBox.readOnly = true;
                    observationBox.style.minHeight = '50px';

                    cardBody.appendChild(observationBox);
                    cardContainer.appendChild(cardBody);

                    cardContainer.style.border = '1px solid #4a5568';
                    cardContainer.style.borderRadius = '5px';
                    cardContainer.style.padding = '10px';
                    cardContainer.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                } else {
                    cardContainer.classList.add('no-text');
                    imageContainer.style.border = '1px solid #4a5568';
                    imageContainer.style.borderRadius = '5px';
                    imageContainer.style.padding = '10px';
                    imageContainer.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                }

                drawingsGallery.appendChild(cardContainer);
            });
        }
    }

    loadDrawings();
}
