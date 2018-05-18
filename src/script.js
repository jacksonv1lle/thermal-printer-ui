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

let mouse = {
	x: 0,
	y: 0
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
		setTimeout(function(){resolve()},500);return;
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
function getPageData(fabric_canvas){
	var ctx = fabric_canvas.contextContainer;
	var imageData = ctx.getImageData(0, 0, fabric_canvas.width, fabric_canvas.height);
	return imageData;
}
function getGoogleFonts(){
	var stylesheets = document.querySelectorAll('link[rel=\'stylesheet\']');
	var fontList = [];
	Array.prototype.forEach.call(stylesheets, (stylesheet)=>{
		var href= stylesheet.getAttribute('href');
		var matches = href.match(/family=(.*)/);
		if(matches && matches.length > 1) {
			var fonts = matches[1];
			var _fontDiv = document.createElement('div');
			var _style = document.createElement('style');
			document.body.appendChild(_fontDiv);
			var style = '';
			fontList = fonts.split('|').map(font=>{
				parsedFont=font.replace('+', ' ');
				var _span = document.createElement('span');
				_span.style.fontFamily = parsedFont;
				_fontDiv.appendChild(_span);
				style += '.font-'+font + '{font-family:' + parsedFont + '}';

				return font
			});
			_style.innerHTML = style;
			document.head.appendChild(_style);
			//document.body.removeChild(_fontDiv);
		}
	});
	return fontList;
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
		pageHeight: 800,
		camera: new Camera(),
		zoom: 1,
		activeObjects: [],
		imageDialogVisible: false,
		threshold: 127,
		greyScaleEnabled: false,
		printStatus: PRINT_STATUS.IDLE,
		printProgress: 0,
		printingDialogVisible: false,
		printingComplete: true,

		/* i-text props */
		textAlign:'left',
		lineHeight: 1.16,
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
        }],
        fontFamily: 'Helvetica',
        fontFamilyList: [{label: 'Helvetica', value: 'Helvetica'}],
        isCtrlKeyPressed: false
	},
	methods: {
		handleImageChange: function(e){
			console.log('change', e);
		},
		getPageData:function(){
			var ctx = this.canvas.contextContainer,
				center = this.camera.getCenter();
			var imageData = ctx.getImageData(-center.x, -center.y, this.pageWidth*this.camera.zoom, this.pageHeight*this.camera.zoom);
			return imageData;
		},
		handleTextBtnClick: function(){
			this.canvas.add(new fabric.IText('My Text', {
				width: this.pageWidth,
				top: 0,
				left: 0,
				fontSize: 20,
				fontFamily: 'Helvetica',
				backgroundColor: '#fff'
			}));
			const objects = this.canvas.getObjects();
			this.canvas.setActiveObject(objects[objects.length-1]);
		},
		handleTextAlignChange: function(value){
			this.textAlign = value;
			this.activeObjects[0] && this.activeObjects[0].type == 'i-text' && this.activeObjects[0].set({'textAlign': value});
		},
		handleLineHeightChange: function(value){
			//this.lineHeight = value;
			this.activeObjects[0] && this.activeObjects[0].type == 'i-text' && this.activeObjects[0].set({'lineHeight': value});
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
		handleFontFamilyChange: function(value){
			this.fontFamily = value;
			this.activeObjects[0] && this.activeObjects[0].type == 'i-text' && this.activeObjects[0].set({'fontFamily': value});
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
			ctx.putImageData(data, -center.x, -center.y, 0, 0, this.pageWidth*this.camera.zoom, this.pageHeight*this.camera.zoom);
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
		handleCenterBtnClick: function(){
			this.centerViewport();
		},
		handleChange: function(){console.log('change')},
		handleRemove: function(){console.log('remove')},
		handlePrintBtnClick: function(e){
			e.preventDefault();
			this.print();
		},
		handleScaleChange: function(){
			console.log('test');
			this.centerViewport();
		},
		handlePrintDialogCancel: function(){
			this.printStatus = PRINT_STATUS.IDLE;
			this.printProgress = 0;
			this.printingDialogVisible = false;
		},
		print: function(){
			//this.canvas.discardActiveObject();
			//this.canvas.requestRenderAll();
			const json = this.canvas.toJSON();
			let _print_canvas_wrap = document.createElement('div');
			_print_canvas_wrap.style.display = "none";
			let _print_canvas = document.createElement('canvas');
			_print_canvas.setAttribute('width', this.pageWidth);
			_print_canvas.setAttribute('height', this.pageHeight);
			_print_canvas_wrap.appendChild(_print_canvas);
			document.body.appendChild(_print_canvas_wrap);
			let print_ctx = _print_canvas.getContext('2d');

			let print_canvas = new fabric.Canvas(_print_canvas,{
				enableRetinaScaling: false
			});

			print_canvas.loadFromJSON(json, () => {
				this.printStatus = PRINT_STATUS.PRINTING;
				this.printingDialogVisible = true;
				var data = print_ctx.getImageData(0, 0, this.pageWidth, this.pageHeight);
				data = applyGreyScale(data, this.threshold);
				print_ctx.putImageData(data, 0, 0, 0, 0, this.pageWidth, this.pageHeight);
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
			});
		},
		centerViewport: function(){
			const left = this.pageWidth / 2,
				  top = this.pageHeight / 2,
				  center = this.canvas.getCenter(),
				  zoom = this.camera.getZoom();
			this.camera.setCenter(new fabric.Point(-this.canvas.width/2 + left * (zoom) , -this.canvas.height/2 + top * (zoom)));
		}
	},
	mounted: function(){
		var _canvas = this.$refs.canvas;
		var _container = _canvas.parentNode;
		googleFonts = getGoogleFonts();
		if(googleFonts) {
			googleFonts = googleFonts.map(font=>{return {value:font,label:font}});
			this.fontFamilyList = this.fontFamilyList.concat(googleFonts);
		}
		this.canvas = new fabric.Canvas(_canvas,{
			selectionLineWidth: 2,
			snapAngle: 45,
			imageSmoothingEnabled: true,
			enableRetinaScaling: false
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

		this.canvas.add(page);

		this.canvas.setWidth(_container.offsetWidth);
		this.canvas.setHeight(_container.offsetHeight);
		this.canvas.calcOffset();

		this.centerViewport();

		//this.canvas.setViewportTransform([ 1, 0, 0, 1, 0, 0 ]);

		window.addEventListener('resize', e => {
			this.canvas.setWidth(_container.offsetWidth);
			this.canvas.setHeight(_container.offsetHeight);
			this.canvas.calcOffset();
		});

		const handleActiveObjects = () => {
			this.activeObjects = this.canvas.getActiveObjects();
			console.log(this.activeObjects);
			if(this.activeObjects.length === 0) return;
			switch(this.activeObjects[0].type){
				case 'i-text':
					this.textAlign = this.activeObjects[0].textAlign;
					break;
				default:
					break;
			}
		};

		this.canvas.on('after:render', this.postRender)
	   .on('selection:created', handleActiveObjects)
	   .on('selection:updated', handleActiveObjects)
	   .on('selection:cleared', handleActiveObjects)
	   .on('before:render', ()=>{
			this.canvas.setZoom(this.camera.getZoom());
			this.canvas.absolutePan(this.camera.getCenter());
		});

		window.addEventListener('keydown', e => {
			console.log(e.keyCode);
		    switch(e.keyCode){
		    	case 17: {
		    		this.isCtrlKeyPressed = true;
		    		break;
		    	}
		    	case 46: {
		    		//Delete
    				var activeObjects = this.canvas.getActiveObjects();
		    		activeObjects.forEach(object=>{
	    				if(!object.isEditing) {
							this.canvas.remove(object);
		    			}
		    		});
		    		break;
		    	}
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
		window.addEventListener('keyup', e => {
		    switch(e.keyCode){
		    	case 17: {
		    		this.isCtrlKeyPressed = false;
		    		break;
		    	}
		    	default:
		    		break;
		    }
		});
		const handleMove = e => {
			if(!this.isCtrlKeyPressed) return;

			const clientX = e.touches ? e.touches[0].clientX : e.clientX;
			const clientY = e.touches ? e.touches[0].clientY : e.clientY;

			const dx = clientX - mouse.x;
			const dy = clientY - mouse.y;
			const camPos = this.camera.getCenter();
			this.camera.setCenter(new fabric.Point(camPos.x - dx, camPos.y - dy));
		};
		window.addEventListener('mousemove', e =>{
			handleMove(e);
			mouse.x = e.clientX;
			mouse.y = e.clientY;
		});

		window.addEventListener("touchstart", (e)=>{
			console.log(e);
			if(e.touches && e.touches.length == 2) {
				mouse.x = e.touches[0].clientX;
				mouse.y = e.touches[0].clientY;
				this.isCtrlKeyPressed = true;
			}
		}, false);
		window.addEventListener("touchmove", e=>{
			handleMove(e);
			mouse.x = e.touches[0].clientX;
			mouse.y = e.touches[0].clientY;
		}, false);
		window.addEventListener("touchend", e=>{
			if(e.touches && e.touches.length != 2) {
				this.isCtrlKeyPressed = false;
			}
		}, false);
		window.addEventListener("mousewheel", e=>{
			console.log(e.deltaY);
			const camPos = this.camera.getCenter();
			this.camera.setCenter(new fabric.Point(camPos.x - e.deltaX, camPos.y - e.deltaY));
		}, false);
	}
});