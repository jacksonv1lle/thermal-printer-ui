var Camera = function(centerPoint){
	this.center = centerPoint || new fabric.Point(0,0);
	this.zoom = 1;
};
Camera.prototype.setCenter = function(center){
	this.center = center;
};
Camera.prototype.getCenter = function(center){
	return this.center;
};
Camera.prototype.setZoom = function(n){
	this.zoom = n;
};
Camera.prototype.getZoom = function(){
	return this.zoom;
};

function applyGreyScale(data, threshold) {
	var buffer = data.data,
		len = buffer.length,
		i = 0,
		lum;
	for (i; i < len; i += 4) {
		lum = buffer[i] * 0.3 + buffer[i + 1] * 0.59 + buffer[i + 2] * 0.11;
		lum = lum < threshold ? 0 : 256;
		buffer[i] = lum;
		buffer[i + 1] = lum;
		buffer[i + 2] = lum;
	}
	return data;
}
function sendData(data) {
	return new Promise(function(resolve, reject) {
		var formData = new FormData();
		formData.append('data', '{\'data\':' + JSON.stringify(data) + '}');
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
		xhr.open('POST', '/print');
		xhr.onreadystatechange = function() {
			if (xhr.readyState > 3 && xhr.status == 200) resolve(xhr.responseText);
			if (xhr.readyState > 3 && xhr.status == 400) reject(xhr.responseText);
		};
		xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
		xhr.send(formData);
	});
}
function getByteArrayChunks(data){
	var buffer = data.data,
		len = buffer.length,
		i = 0,
		buffer8pixelsByte = new Uint8ClampedArray(Math.ceil(len / 32));

	/* every 8 pixels is represented as binary value */
	for (i; i < len; i += 32) {
		var arr = [buffer[i], buffer[i + 4], buffer[i + 8], buffer[i + 12], buffer[i + 16], buffer[i + 20], buffer[i + 24], buffer[i + 28]];
		var binStr = arr.map(bit => bit > 0 ? 0 : 1).join('');
		buffer8pixelsByte[i / 32] = parseInt(binStr, 2);
	}


	/* Remove unwanted trailing whitespace after content */
	var end = 0,
		k = buffer8pixelsByte.length -1;
	for(k;k>=0;k--) {
		if(buffer8pixelsByte[k] === 255) continue;
		end = k;
		break;
	}
	console.log('Remove: ' + (buffer8pixelsByte.length - end));
	buffer8pixelsByte = buffer8pixelsByte.slice(0, end);



	/* Split array into smaller chunks so we do not overload the printer */
	var chunks = [],
		j, temparray, chunk = 480;
	for (j = 0; j < buffer8pixelsByte.length; j += chunk) {
		temparray = buffer8pixelsByte.slice(j, j + chunk);
		chunks.push(temparray);
		var str = '';
		str += temparray.join(',');
	}
	return chunks;	
}
const PRINT_STATUS = {
	IDLE: 0,
	PRINTING: 1,
	COMPLETE: 2
};
var app = new Vue({
	el: '#app',
	data: {
		pageWidth: 384,
		pageHeight: 1000,
		camera: null,
		activeObjects: [],
		imageDialogVisible: false,
		threshold: 127,
		greyScaleEnabled: false,
		printStatus: PRINT_STATUS.IDLE,
		printProgress: 0,
		printingDialogVisible: false,
		printingComplete: true,
		alignOptions: [{
			value: 'left',
			label: 'left'
        }, {
			value: 'center',
			label: 'center'
        }, {
			value: 'right',
			label: 'right'
        }, {
	    	value: 'justify',
	    	label: 'justify'
        }, {
			value: 'justify-left',
			label: 'justify-left'
        }, {
			value: 'justify-center',
			label: 'justify-center'
        }, {
			value: 'justify-right',
			label: 'justify-right'
        }]
	},
	methods: {
		handleImageChange: function(e){
			console.log('change', e);
		},
		getPageData:function(){
			var ctx = this.canvas.contextContainer,
				center = this.camera.getCenter();
			var imageData = ctx.getImageData(-center.x, -center.y, this.pageWidth, this.pageHeight);
			return imageData;
		},
		handleTextBtnClick: function(){
			this.canvas.add(new fabric.IText('My Text', {
				width: this.pageWidth,
				top: 0,
				left: 0,
				fontSize: 20,
				fontFamily: 'Helvetica',
			}));
			const objects = this.canvas.getObjects();
			this.canvas.setActiveObject(objects[objects.length-1]);
		},
		handleFontSizeChange(e){
			console.log(e);
		},
		handleImageDialogCancel: function(e){
			const upload = this.$refs.upload;
			this.imageDialogVisible = false;
			upload.clearFiles();
		},
		handleRemoveBtnClick: function(){
			/*Remove selected item(s)*/
			var activeObjects = this.canvas.getActiveObjects();
			if (activeObjects) {
				this.canvas.discardActiveObject();
				activeObjects.forEach(object => {
					this.canvas.remove(object);
				});
			}
		},
		handleRotateBtnClick: function(){
			var obj = this.canvas.getActiveObject();
			if(!obj) return;

            var ctx = this.canvas.contextContainer,
                imgWidth = obj.width,
                imgHeight = obj.height,
                aspect = imgHeight / imgWidth,
                aspect_ = imgWidth / imgHeight,
                minWidth = this.pageWidth,
                minHeight = minWidth * aspect;

            let angle = obj.get('angle');
            console.log('angle ', angle);
            if(angle>=0&&angle<90) angle=90;
            else if(angle>=90&&angle<180) angle=180;
            else if(angle>=180&&angle<270) angle=270;
            else if(angle>=270&&angle<360) angle=0;

			var scaleX = angle%180===0?this.pageWidth / obj.width:this.pageWidth / obj.height;
			var scaleY = angle%180===0?this.pageWidth / (obj.height * aspect_):this.pageWidth / (obj.width * aspect);

			var top = (angle == 180)?minHeight:(angle == 270)?minWidth*aspect_:0;
			var left = (angle == 90 || angle == 180)?minWidth:0;
			obj.set({
				angle: angle,
				top: top,
				left: left,
				scaleX: scaleX,
				scaleY: scaleY,
			});

			obj.setCoords();
			this.canvas.renderAll();
			this.canvas.calcOffset();
		},
		postRender: function(){
			var data = this.getPageData();
			if(this.greyScaleEnabled) data = applyGreyScale(data, this.threshold);
			var ctx = this.canvas.contextContainer;
			var center = this.camera.getCenter();
			ctx.putImageData(data, -center.x, -center.y, 0, 0, this.pageWidth, this.pageHeight);
		},
		handleImageDialogConfirm: function(){
			const upload = this.$refs.upload;
			const files = upload.uploadFiles;
			if(!files) return;
			if (FileReader && files && files.length > 0) {
				var fr = new FileReader();
				fr.onload = () => {
					const image = new Image();
					image.onload = () => {
						const aspect = image.width / image.height;
						this.canvas.add(new fabric.Image(image, {
							lockUniScaling: true,
							scaleX: this.pageWidth / image.width,
							scaleY: this.pageWidth / (image.height * aspect)
						}));
						this.imageDialogVisible = false;
						upload.clearFiles();
						const objects = this.canvas.getObjects();
						this.canvas.setActiveObject(objects[objects.length-1]);
					};
					image.src = fr.result;
				};
				fr.readAsDataURL(files[0].raw);
			}
		},
		handleChange: function(){console.log('change')},
		handleRemove: function(){console.log('remove')},
		handlePrintBtnClick: function(e){
			e.preventDefault();
			var pageData = this.getPageData();
			if (pageData) {
				this.print(pageData);
			}
		},
		handlePrintDialogCancel: function(){
			this.printStatus = PRINT_STATUS.IDLE;
			this.printProgress = 0;
			this.printingDialogVisible = false;
		},
		print: function(){
			this.canvas.discardActiveObject();
			this.canvas.requestRenderAll();
			this.printStatus = PRINT_STATUS.PRINTING;
			this.printingDialogVisible = true;
			var data = this.getPageData();
			console.log(data);
			var chunks = getByteArrayChunks(data);
			console.log(chunks);
			this.printProgress = 0;
			const printChunk = async(i) => {
				this.printProgress = Math.ceil((i / chunks.length) * 100);
				if (i > chunks.length - 1 || this.printStatus === PRINT_STATUS.IDLE || this.printStatus === PRINT_STATUS.COMPLETE) {
					this.printStatus = PRINT_STATUS.COMPLETE;
					return;
				}
				try {
					var res = await sendData(Array.from(chunks[i]));
					printChunk(i + 1);
				} catch (e) {
					console.log('There was a problem', e);
				}
			};
			printChunk(0);
		}
	},
	mounted: function(){
		var _canvas = this.$refs.canvas;
		var _container = _canvas.parentNode;
		this.canvas = new fabric.Canvas(_canvas,{
			selectionLineWidth: 2,
			snapAngle: 45,
			imageSmoothingEnabled: true
		});
		var page = new fabric.Rect({
			left: 0,
			top: 0,
			fill: '#fff',
			width: this.pageWidth,
			height: this.pageHeight,
			selectable: false,
			hoverCursor: 'default',
			excludeFromExport: true
		});


		var centerViewport = () => {
			const left = this.pageWidth / 2,
				  top = this.pageHeight / 2,
				  center = this.canvas.getCenter(),
				  zoom = this.camera.getZoom();
			this.camera.setCenter(new fabric.Point(-this.canvas.width/2 + left * (zoom) , -this.canvas.height/2 + top * (zoom)));
		};

		this.canvas.add(page);

		this.canvas.setWidth(_container.offsetWidth);
		this.canvas.setHeight(_container.offsetHeight);
		this.canvas.calcOffset();

		this.camera = new Camera();
		centerViewport();
		

		window.addEventListener('resize', e => {
			this.canvas.setWidth(_container.offsetWidth);
			this.canvas.setHeight(_container.offsetHeight);
			this.canvas.calcOffset();
		});

		this.canvas.on('after:render', this.postRender).on('selection:created', () => {
			this.activeObjects = this.canvas.getActiveObjects();
		}).on('selection:updated', () => {
			this.activeObjects = this.canvas.getActiveObjects();
		}).on('selection:cleared', () => {
			this.activeObjects = this.canvas.getActiveObjects();
		}).on('before:render', ()=>{
			this.canvas.absolutePan(this.camera.getCenter());
			this.canvas.setZoom(this.camera.getZoom());
		});

		window.addEventListener('keydown', e => {
			console.log(e.keyCode);
		    switch(e.keyCode){
		    	case 38: {
		    		//up
		    		let pos = this.camera.getCenter();
		    		this.camera.setCenter(new fabric.Point(pos.x, pos.y + 10));
		    		break;	
		    	}
	    		case 39: {
	    			//right
		    		let pos = this.camera.getCenter();
		    		this.camera.setCenter(new fabric.Point(pos.x - 10, pos.y));
	    			break;	
	    		}
    			case 40: {
    				//down
		    		let pos = this.camera.getCenter();
		    		this.camera.setCenter(new fabric.Point(pos.x, pos.y - 10));
    				break;	
    			}
				case 37: {
					//left
		    		let pos = this.camera.getCenter();
		    		this.camera.setCenter(new fabric.Point(pos.x + 10, pos.y));
					break;	
				}
	    		default: break;
		    }
		});
	}
});