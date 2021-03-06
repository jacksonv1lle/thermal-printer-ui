"use strict";
let mouse = {
	x: 0,
	y: 0
};

const PRINTER = {
    /* Default Printer props */
    heatTime: 125,
    heatInterval: 40,
    printDensity: 20,
    printBreakTime: 2,	
};

const handleSize = 30;
const handleColor = "#000";

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
function applyFloydSteinberg(data) {
    var buffer = data.data,
        len = buffer.length,
        w = data.width * 4,
        h = data.height;
    for (var i = 0; i < h; i++)
        for (var j = 0; j < w; j += 4) {

            var ci = i * w + j;
			let lum = buffer[ci] * 0.3 + buffer[ci + 1] * 0.59 + buffer[ci + 2] * 0.11;

            var cc1 = lum;
            var cc2 = lum;
            var cc3 = lum;
            var rc1 = (cc1 < 128 ? 0 : 255);
            var rc2 = (cc2 < 128 ? 0 : 255);
            var rc3 = (cc3 < 128 ? 0 : 255);
            var err1 = cc1 - rc1;
            var err2 = cc2 - rc2;
            var err3 = cc3 - rc3;
            buffer[ci] = rc1;
            buffer[ci + 1] = rc2;
            buffer[ci + 2] = rc3;
            if (j + 1 + 3 < w) {
                buffer[ci + 1 + 3] += (err1 * 7) >> 4;
                buffer[ci + 1 + 4] += (err2 * 7) >> 4;
                buffer[ci + 1 + 5] += (err3 * 7) >> 4;
            }
            if (i + 1 == h) continue;
            if (j > 0) {
                buffer[ci + w - 1] += (err1 * 3) >> 4;
                buffer[ci + w - 1 + 1] += (err2 * 3) >> 4;
                buffer[ci + w - 1 + 2] += (err3 * 3) >> 4;
            }
            buffer[ci + w] += (err1 * 5) >> 4;
            buffer[ci + w + 1] += (err2 * 5) >> 4;
            buffer[ci + w + 2] += (err3 * 5) >> 4;
            if (j + 1 + 3 < w) {
                buffer[ci + w + 1] += (err1 * 1) >> 4;
                buffer[ci + w + 2] += (err2 * 1) >> 4;
                buffer[ci + w + 3] += (err3 * 1) >> 4;
            }
        }
    return data;
}
function applyBayerMatrix(data, n){
	var buffer = data.data,
        len = buffer.length,
        w = data.width * 4,
        h = data.height;
    let unit = 1 / (n*n+1);
    let matrix = [];
    switch(n){
    	case 3:
    		matrix = [[0,7,3],[6,5,2],[4,1,8]];
    		break;
    	case 4:
    		matrix = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    		break;
    	case 8:
    		matrix = [[0, 48, 12, 60, 3, 51, 15, 63], 
    				  [32, 16, 44, 28, 35, 19, 47, 31], 
    				  [8, 56, 4, 52, 11, 59, 7, 55], 
    				  [40, 24, 36, 20, 43, 27, 39, 23],
    				  [2, 50, 14, 62, 1, 49, 13, 61],
    				  [34, 18, 46, 30, 33, 17, 45, 29],
    				  [10, 58, 6, 54, 9, 57, 5, 53],
    				  [42, 26, 38, 22, 41, 25, 37, 21]];
    		break;
    	case 2:
    	default:
    		matrix = [[0,2],[3,1]];
    		break;
    }
	for(var y=0;y<h;y++){
		for(var x=0;x<w;x+=4){
			var ci = y * w + x;
			let lum = buffer[ci] * 0.3 + buffer[ci + 1] * 0.59 + buffer[ci + 2] * 0.11;
			let threshold = matrix[(x/4)%n][y%n];
			threshold = (threshold+1) * unit * 255;
			lum = lum < threshold ? 0 : 256;
			buffer[ci] = lum;
			buffer[ci + 1] = lum;
			buffer[ci + 2] = lum;
		}
	}
	return data;
}
function sendData(data) {
	return new Promise(function(resolve, reject) {
		//setTimeout(function(){resolve()},500);return;
		var formData = new FormData();
		formData.append("data", "{'data':" + JSON.stringify(data) + "}");
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
		xhr.open('POST', '/print');
		xhr.onreadystatechange = function() {
			if(xhr.readyState > 3) {
				switch(xhr.status) {
					case 200:
						resolve(xhr.responseText);
						break;
					default:
						reject(xhr.responseText);
						break;
				}	
			}
		};
		xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
		xhr.send(formData);
	});
}
function sendPrinterConfig(config) {
	return new Promise(function(resolve, reject) {
		var formData = new FormData();
		formData.append("data", JSON.stringify(config));
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
		xhr.open('POST', '/config');
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
	var stylesheets = document.querySelectorAll("link[rel='stylesheet']");
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
				let value = font.replace(/\+/g, '-');
				let label = font.replace(/\+/g, ' ');
				var _span = document.createElement('span');
				_span.style.fontFamily = label;
				_fontDiv.appendChild(_span);
				style += '.font-'+value + '{font-family:' + label + '}';

				return font;
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
		zoom: 1,
		maxZoom: 2,
		minZoom: 0.1,
		activeObjects: [],
		imageDialogVisible: false,
		noPaperDialogVisible: false,
		failureDialogVisible: false,
		threshold: 127,
		filter: '1',
		bayerSize: '2',
		printStatus: PRINT_STATUS.IDLE,
		printProgress: 0,
		printingDialogVisible: false,
		printingComplete: true,
		controlsOpen: false,

		/* i-text props */
		textValue: 'Hi there',
		textAlign:'left',
		fontSize: 20,
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
        keys:[],

        /* Printer props */
        heatTime: PRINTER.heatTime,
        heatInterval: PRINTER.heatInterval,
        printDensity: PRINTER.printDensity,
        printBreakTime: PRINTER.printBreakTime,
	},
	methods: {
		handleImageChange: function(e){
			console.log('change', e);
		},
		getPageData:function(){
			var ctx = this.canvas.contextContainer,
				center = new fabric.Point(this.canvas.viewportTransform[4], this.canvas.viewportTransform[5]);
			var imageData = ctx.getImageData(center.x*window.devicePixelRatio, center.y*window.devicePixelRatio, this.pageWidth*this.zoom*window.devicePixelRatio, this.pageHeight*this.zoom*window.devicePixelRatio);
			return imageData;
		},
		handleTextBtnClick: function(){
			this.textValue = 'Enter text';
			var activeObjects = this.canvas.getActiveObjects();
			activeObjects.forEach(object => {
				if(object.type == 'image' && object.meta) {
					console.log('meta', object.meta);
					let date = object.meta.DateTimeOriginal || object.meta.DateTime;
					if(date) {
						date = moment(date, "YYYY:MM:DD kk:mm:ss");
						if(date.isValid()) {
							this.textValue = date.format("MMM D, YYYY");
						}
					}
				}
			});
			let iText = new fabric.IText(this.textValue, {
				width: this.pageWidth,
				top: 0,
				left: 0,
				fontSize: 20,
				fontFamily: 'Helvetica',
				backgroundColor: '#fff',
				cornerSize: handleSize,
				borderColor: handleColor,
				cornerColor: handleColor,
				transparentCorners: false,
			});
			iText.setControlsVisibility({
				mt: false, 
				mb: false, /* Only allow rect to be scaled from the bottom */
				ml: false, 
				mr: false, 
			});
			this.canvas.add(iText);
			const objects = this.canvas.getObjects();
			this.canvas.setActiveObject(objects[objects.length-1]);
			this.canvas.renderAll();
		},
		handleFilterChange:function(value){
			window.localStorage.setItem('filter', value);
			this.canvas.renderAll();
		},
		handleBayerSizeChange: function(value){
			window.localStorage.setItem('bayerSize', value);
			this.canvas.renderAll();
		},
		handleThresholdChange: function(value){
			window.localStorage.setItem('threshold', value);
			this.canvas.renderAll();
		},
		handlePrinterConfigChange: function(value){
			let config = {
				heatTime: this.heatTime,
				heatInterval: this.heatInterval,
				printDensity: this.printDensity,
				printBreakTime: this.printBreakTime
			};
			window.localStorage.setItem('config', JSON.stringify(config));
			sendPrinterConfig(config).then(data=>{console.log(data);}).catch(e=>{console.log(e);});
		},
		handleDefaultsBtnClick: function(e){
			e.preventDefault();	
	        this.heatTime = PRINTER.heatTime;
	        this.heatInterval = PRINTER.heatInterval;
	        this.printDensity = PRINTER.printDensity;
	        this.printBreakTime = PRINTER.printBreakTime;
			let config = {
				heatTime: this.heatTime,
				heatInterval: this.heatInterval,
				printDensity: this.printDensity,
				printBreakTime: this.printBreakTime
			};
			window.localStorage.setItem('config', JSON.stringify(config));
		},
		handleTextAlignChange: function(value){
			this.textAlign = value;
			this.activeObjects[0] && this.activeObjects[0].type == 'i-text' && this.activeObjects[0].set({'textAlign': value});
			this.canvas.renderAll();
		},
		handleLineHeightChange: function(value){
			//this.lineHeight = value;
			this.activeObjects[0] && this.activeObjects[0].type == 'i-text' && this.activeObjects[0].set({'lineHeight': value});
			this.canvas.renderAll();
		},
		handleTextValueChange: function(value){
			//this.lineHeight = value;
			this.activeObjects[0] && this.activeObjects[0].type == 'i-text' && this.activeObjects[0].set({'text': value});
			this.canvas.renderAll();
		},
		handleFontSizeChange(value){
			this.activeObjects[0] && this.activeObjects[0].type == 'i-text' && this.activeObjects[0].set({'fontSize': value});
			this.canvas.renderAll();
		},
		handleToggleClick(e){
			this.controlsOpen = !this.controlsOpen;
		},
		handleImageDialogCancel: function(e){
			const upload = this.$refs.upload;
			this.imageDialogVisible = false;
			upload.clearFiles();
		},
		handleUpBtnClick: function(){
			var activeObjects = this.canvas.getActiveObjects();
			activeObjects.forEach(object => {
				if(object.lockMovementY) return;
				let left = object.left;
				let top = object.top;
				object.set({
					left: left, 
					top: top - 1
				});
			});
			this.canvas.renderAll();
		},
		handleDownBtnClick: function(){
			var activeObjects = this.canvas.getActiveObjects();
			activeObjects.forEach(object => {
				if(object.lockMovementY) return;
				let left = object.left;
				let top = object.top;
				object.set({
					left: left, 
					top: top + 1
				});
			});
			this.canvas.renderAll();
		},
		handleLeftBtnClick: function(){
			var activeObjects = this.canvas.getActiveObjects();
			activeObjects.forEach(object => {
				if(object.lockMovementX) return;
				let left = object.left;
				let top = object.top;
				object.set({
					left: left - 1, 
					top: top
				});
			});
			this.canvas.renderAll();
		},
		handleRightBtnClick: function(){
			var activeObjects = this.canvas.getActiveObjects();
			activeObjects.forEach(object => {
				if(object.lockMovementX) return;
				let left = object.left;
				let top = object.top;
				object.set({
					left: left + 1, 
					top: top
				});
			});
			this.canvas.renderAll();
		},
		handleRemoveBtnClick: function(){
			/*Remove selected item(s)*/
			var activeObjects = this.canvas.getActiveObjects();
			if (activeObjects) {
				activeObjects.forEach(object => {
					if(object.type === 'rect') return; //Do not remove the page object
					this.canvas.discardActiveObject();
					this.canvas.remove(object);
				});
			}
			this.canvas.renderAll();
		},
		handleFontFamilyChange: function(value){
			this.fontFamily = value.replace(/\-/g, ' ');
			window.localStorage.setItem('fontFamily', this.fontFamily);
			this.activeObjects[0] && this.activeObjects[0].type == 'i-text' && this.activeObjects[0].set({'fontFamily': this.fontFamily});
			this.canvas.renderAll();
		},
		handleInvertBtnClick: function(){
			if(this.activeObjects[0] && this.activeObjects[0].type == 'i-text') {
				let color = this.activeObjects[0].backgroundColor == '#fff' ? '#fff' : '#000';
				let backgroundColor = color == '#fff' ? '#000' : '#fff';
				this.activeObjects[0].set({'backgroundColor': backgroundColor, 'fill': color});
			}
			this.canvas.renderAll();
		},
		handleRotateBtnClick: function(){
			var obj = this.canvas.getActiveObject();
			if(!obj) return;
			if(obj.lockRotation) return;

            var ctx = this.canvas.contextContainer,
                imgWidth = obj.width,
                imgHeight = obj.height,
                aspect = imgHeight / imgWidth,
                aspect_ = imgWidth / imgHeight,
                minWidth = this.pageWidth,
                minHeight = minWidth * aspect;

            let angle = obj.get('angle');
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
			console.log('post render');
			if(this.canvas.isDragging) return;
			var data = this.getPageData();
			if(this.filter == '1') data = applyFloydSteinberg(data);
			if(this.filter == '2') data = applyBayerMatrix(data, parseInt(this.bayerSize));
			if(this.filter == '3') data = applyGreyScale(data, this.threshold);
			var ctx = this.canvas.contextContainer;
			var center = center = new fabric.Point(this.canvas.viewportTransform[4], this.canvas.viewportTransform[5]);
			ctx.putImageData(data, center.x*window.devicePixelRatio, center.y*window.devicePixelRatio, 0, 0, this.pageWidth*this.zoom*window.devicePixelRatio, this.pageHeight*this.zoom*window.devicePixelRatio);
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
						let fabImage = new fabric.Image(image, {
							lockUniScaling: true,
							cornerSize: handleSize,
							borderColor: handleColor,
							cornerColor: handleColor,
							transparentCorners: false,
							scaleX: this.pageWidth / image.width,
							scaleY: this.pageWidth / (image.height * aspect)
						});
						EXIF.getData(image, function() {
							let meta = EXIF.getAllTags(this);
							fabImage.set({'meta': meta});
					    });
						this.canvas.add(fabImage);
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
			let left = this.canvas.viewportTransform[4];
			let top = this.canvas.viewportTransform[5];
			let center = new fabric.Point(this.canvas.width * 0.5, this.canvas.height * 0.5);
			let pageObj = this.canvas.getObjects()[0];
			let pageHalfWidth = pageObj.width * this.zoom * 0.5;
			let pageHalfHeight = pageObj.height * this.zoom * 0.5;
			this.canvas.relativePan({x: center.x - left - pageHalfWidth,y: -top + 50});
		},
		handleChange: function(){console.log('change')},
		handleRemove: function(){console.log('remove')},
		handlePrintBtnClick: function(e){
			e.preventDefault();
			this.print();
		},
		handleScaleChange: function(value){
			window.localStorage.setItem('zoom', this.zoom);
			let center = this.canvas.getCenter();
			//console.log(center);
			this.canvas.zoomToPoint({ x: center.left, y: center.top }, this.zoom);
			//this.canvas.setZoom(this.zoom);
			//this.canvas.absolutePan(new fabric.Point(this.vx, this.vy));
		},
		closePrinterDialog: function(){
			this.printStatus = PRINT_STATUS.IDLE;
			this.printProgress = 0;
			this.printingDialogVisible = false;
		},
		handlePrintDialogCancel: function(){
			this.closePrinterDialog();
		},
		handleNoPaperDialogCancel: function(){
			this.noPaperDialogVisible = false;
		},
		handleFailureDialogCancel: function(){
			this.failureDialogVisible = false;
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

				if(this.filter == '1') data = applyFloydSteinberg(data);
				if(this.filter == '2') data = applyBayerMatrix(data, parseInt(this.bayerSize));
				if(this.filter == '3') data = applyGreyScale(data, this.threshold);

				print_ctx.putImageData(data, 0, 0, 0, 0, this.pageWidth, this.pageHeight);
				var chunks = getByteArrayChunks(data);
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
						console.log('There was a problem: ', e);
						var res = JSON.parse(e);
						switch(res.code) {
							case 503:
								this.closePrinterDialog();
								this.noPaperDialogVisible = true;
								break;
							case 400:
							default:
								this.closePrinterDialog();
								this.failureDialogVisible = true;
								break;
						}
					}
				};
				printChunk(0);
			});
		}
	},
	mounted: function(){
		let settings = window.localStorage;
		if(settings) {
			this.bayerSize = settings.bayerSize || this.bayerSize;
			this.filter = settings.filter || this.filter;
			this.threshold = parseInt(settings.threshold) || this.threshold;
			this.zoom = parseFloat(settings.zoom) || this.zoom;
	   		this.pageHeight = parseFloat(settings.pageHeight) || this.pageHeight;
			if(settings.config) {
				try{
					let config = JSON.parse(settings.config);
					this.heatTime = config.heatTime;
					this.heatInterval = config.heatInterval;
					this.printDensity = config.printDensity;
					this.printBreakTime = config.printBreakTime;
					sendPrinterConfig(config);
				} catch(e){
					console.log('Unable to parse config');
				}
			}	
		}

		var _canvas = this.$refs.canvas;
		var _container = _canvas.parentNode;
		var googleFonts = getGoogleFonts();
		if(googleFonts) {
			googleFonts = googleFonts.map(font=>{
				let value = font.replace(/\+/g, '-');
				let label = font.replace(/\+/g, ' ');
				return {
					value:font.replace(/\+/g, '-'),
					label:font.replace(/\+/g, ' ')
				}});
			this.fontFamilyList = this.fontFamilyList.concat(googleFonts);
		}
		this.canvas = new fabric.Canvas(_canvas,{
			selectionLineWidth: 2,
			snapAngle: 45,
			imageSmoothingEnabled: true,
			//enableRetinaScaling: false,
			preserveObjectStacking: true
		});
		var page = new fabric.Rect({
			left: 0,
			top: 0,
			fill: '#fff',
			stroke: '#666',
			strokeWidth: 1,
			width: this.pageWidth,
			height: this.pageHeight,
			//selectable: false,
			lockScalingX: true,
			lockMovementX: true,
			lockMovementY: true,
			lockRotation: true,
			hoverCursor: 'default',
			excludeFromExport: true,
			cornerSize: handleSize,
			borderColor: handleColor,
			cornerColor: handleColor,
			transparentCorners: false,
		});
 		
 		/* Only allow rect to be scaled from the bottom */
		page.setControlsVisibility({
			mt: false, 
			mb: true,
			ml: false, 
			mr: false, 
			bl: false,
			br: false, 
			tl: false, 
			tr: false,
			mtr: false
		});
		this.canvas.add(page);

		this.canvas.setWidth(_container.offsetWidth);
		this.canvas.setHeight(_container.offsetHeight);
		this.canvas.calcOffset();

		this.canvas.setZoom(this.zoom);
		this.handleCenterBtnClick();

		window.addEventListener('resize', e => {
			this.canvas.setWidth(_container.offsetWidth);
			this.canvas.setHeight(_container.offsetHeight);
			this.canvas.calcOffset();
		});

		const handleActiveObjects = () => {
			this.activeObjects = this.canvas.getActiveObjects();
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
	   	.on('object:scaling', ()=>{
	   		var obj = this.canvas.getActiveObject();
	   		if(obj.type !== 'rect') return;
	   		var height = obj.height * obj.scaleY;
	   		this.pageHeight = height;
	   		window.localStorage.setItem('pageHeight', height);
	   	})
	   	.on('text:changed', ()=>{
	   		var obj = this.canvas.getActiveObject();
	   		if(obj.type !== 'i-text') return;
	   		this.textValue = obj.text;
	   	});

		fabric.Canvas.prototype.disable = function() {
			console.log('disable');
			this.set({'selection': false});
		    this.getObjects().forEach(function(o) {
				o.selectable = false;
			});
			this.discardActiveObject();
			this.requestRenderAll();
			this.isEnabled = false;
	    };
	    fabric.Canvas.prototype.enable = function() {
			console.log('enable');
	    	this.set({'selection': true});
		    this.getObjects().forEach(function(o) {
				o.selectable = true;
			});
			this.isEnabled = true;
	    };

		window.addEventListener('keydown', e => {
			
			this.keys[e.keyCode] = true;
		    switch(e.keyCode){
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
		    		this.handleUpBtnClick();
		    		break;	
		    	}
	    		case 39: {
	    			//right
		    		this.handleRightBtnClick();
	    			break;	
	    		}
    			case 40: {
    				//down
		    		this.handleDownBtnClick();
    				break;	
    			}
				case 37: {
					//left
		    		this.handleLeftBtnClick();
					break;	
				}
	    		default: break;
		    }
		    if(this.keys[17] && this.keys[187]) {
		    	//zoom out
		    }
		    if(this.keys[17] && this.keys[189]) {
		    	//zoom in
		    }
		});
		window.addEventListener('keyup', e => {
			this.keys[e.keyCode] = false;
		    switch(e.keyCode){
		    	case 18:
		    		e.preventDefault();
		    		break;
		    	default:
		    		break;
		    }
		});

		/* Check if user has switched away from window every second */
		setInterval(()=>{
			if(!document.hasFocus()){
				this.keys = [];
			}
		}, 1000);

		let posX = 0;
		let posY = 0;

		if(fabric.isTouchSupported) {
			this.canvas.disable();
		}
		let firstzoom = this.zoom;
		let lastX = 0;
		let lastY = 0;
		this.canvas.on('touch:gesture', opt => {
			var e = opt.e;
			let fingers = opt.self.fingers;
			let scale = opt.self.scale;
			let rotation = opt.self.rotation;
			let x = opt.self.x;
			let y = opt.self.y;
			let state = opt.self.state;
			if(state === 'start'){
				firstzoom = this.zoom;
				lastX = x;
				lastY = y;
			}
			let zoom = firstzoom * scale;

			if(zoom < this.minZoom) {
				zoom = this.minZoom;
			}
			if(zoom > this.maxZoom){
				this.zoom = this.maxZoom;
			}
			this.zoom = zoom;

			this.canvas.zoomToPoint({ x: x, y: y }, this.zoom);

		});
		this.canvas.on('touch:longpress', opt => {
			if(fabric.isTouchSupported) {
				this.canvas.enable();
    			this.canvas.isDragging = false;
				let x = opt.self.x;
				let y = opt.self.y;
				let state = opt.self.state;
				if(state === 'start'){
					let pointer = this.canvas.getPointer(opt.e, true);
					let objects = this.canvas.getObjects();
					let hitObject;
					for(var i = objects.length-1;i>=0;i--){
						if(this.canvas.containsPoint(opt.e, objects[i], new fabric.Point(pointer.x, pointer.y))) {
							hitObject = objects[i];
							i=-1;
						}
					}
					if(hitObject) {
						this.canvas.setActiveObject(hitObject);	
						this.canvas.requestRenderAll();
					}
				}
		   		//this.canvas.selection = true;
			}
		});
		this.canvas.on('touch:shake', opt => {
			this.canvas.discardActiveObject();
			this.canvas.requestRenderAll();
			if(fabric.isTouchSupported) {
				this.canvas.disable();
			}
		});
		this.canvas.on('touch:drag', opt => {
			let fingers = opt.self.fingers;
			let x = opt.self.x;
			let y = opt.self.y;
			let state = opt.self.state;
			let start = opt.self.start;
			if(state == "down") {
				if(fabric.isTouchSupported) {
					let objects = this.canvas.getObjects();
					let pointer = this.canvas.getPointer(opt.e, true);
					let hit = false;
					objects.forEach(obj=>{
						if(this.canvas.containsPoint(opt.e, obj, new fabric.Point(pointer.x, pointer.y))) {
							hit = true;
						}
					});
					console.log(hit);
					if(!hit) {
						this.canvas.disable();
					}
	    			this.canvas.isDragging = true;
					
				    posX = start.x;
				    posY = start.y;
				} else if(this.keys[32]) {
					this.canvas.disable();
					this.canvas.isDragging = true;
				    posX = start.x;
				    posY = start.y;
				}
			} else if(state == "move"){
				if (this.canvas.isDragging && !this.canvas.isEnabled) {
					this.canvas.relativePan(new fabric.Point(x - posX, y - posY));
					this.canvas.requestRenderAll();
				}
				posX = x;
				posY = y;
			} else if(state == "up"){
				if(fabric.isTouchSupported) {
					var activeObjects = this.canvas.getActiveObjects();
					if(activeObjects.length===0) {
						this.canvas.disable();
					}
				} else {
					this.canvas.enable();
				}
				this.canvas.isDragging = false;
			}
		});
			
		this.canvas.on('mouse:move', opt => {
			if(this.canvas.isDragging) return;
			var e = opt.e;
			posX = e.clientX;
			posY = e.clientY;
		});
		this.canvas.on('mouse:wheel', opt => {
			var e = opt.e;
			e.preventDefault();
			e.stopPropagation();
			if(this.keys[17] && this.keys[18]) {
				//Zoom when Ctrl + Alt are pressed
				var pointer = this.canvas.getPointer(e, true);
				this.zoom = this.canvas.getZoom();
				if(e.deltaY >= this.minZoom) {
					this.zoom -= 0.1;
					this.zoom = Math.max(this.zoom, this.minZoom);
				}
				else {
					this.zoom += 0.1;
					this.zoom = Math.min(this.zoom, this.maxZoom);
				}
				window.localStorage.setItem('zoom', this.zoom);
				this.canvas.zoomToPoint({ x: e.offsetX, y: e.offsetY }, this.zoom);
			} else if(this.keys[17]){
				//Scroll horizontally when ctrl is pressed
				this.canvas.relativePan(new fabric.Point(e.deltaY, 0));
			} else {
				//Scroll vertically
				this.canvas.relativePan(new fabric.Point(e.deltaX, e.deltaY));
			}
		});
	}
});
