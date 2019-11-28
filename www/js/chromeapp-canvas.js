// TODO: Read version from config.xml
let VERSION = '1.0.3';
let v = document.getElementById('video');
let canvas = document.getElementById('c');
let context = canvas.getContext('2d');
let ip = document.getElementById('esp32_ip'),
    port = document.getElementById('udp_port'),
    contrast = document.getElementById('v_contrast'),
    v_width  = document.getElementById('v_width'),
    v_height = document.getElementById('v_height'),
    v_units  = document.getElementById('v_units'),
    video = document.getElementById('video'),
    video_select = document.getElementById('video_select'),
    millis_frame = document.getElementById('millis_frame'),
    protocol = document.getElementById('protocol'),
    transmission = document.getElementById('transmission'),
    quality = document.getElementById('bro_quality'),
    v_brightness = document.getElementById('v_brightness');
let t_empty = '&#9633;';
let socketId, oldPort = port.value; 
let cw = parseInt(v_width.value),
ch = parseInt(v_height.value)*parseInt(v_units.value),
unitH = parseInt(v_height.value);
let ua = navigator.userAgent.toLowerCase();
let isAndroid = ua.indexOf("android") > -1;
let storage = window.localStorage;
let isSocketOpen = false;

// DOMContentLoaded   -> deviceready for cordova
document.addEventListener('deviceready', function(){
    let cameraConfig = {
      quality:50,
      destinationType: Camera.DestinationType.FILE_URI,
      sourceType: Camera.PictureSourceType.CAMERA,
      mediaType: Camera.MediaType.VIDEO,
      encodingType: Camera.EncodingType.JPEG,
      cameraDirection: Camera.Direction.BACK
    };
    // Start - EventListeners
    loadFormState()

    document.getElementById('main-form').onchange = function () {
        saveFormState();
    };

    if (validateIp(ip.value, true)) {
      openSocket();
    }

    video_select.onchange = function() {
        if (video_select.value !== '') {
            cleanTransmission();
            video.setAttribute('src','video/'+video_select.value);
            ch = parseInt(v_height.value)*parseInt(v_units.value);
            canvas.width = parseInt(v_width.value);
            canvas.height = ch;
        }
    };
    ip.onchange = function() {
        cleanTransmission();
    };
    port.onchange = function() {
        cleanTransmission();
    };
    v_height.onchange = function() {
        cleanTransmission();
        ch = parseInt(v_height.value)*parseInt(v_units.value);
        canvas.height = ch;
    }
    v_units.onchange = function() {
        ch = parseInt(v_height.value)*parseInt(v_units.value);
        canvas.height = ch;
        cleanTransmission();
    }
    protocol.onchange = function() {
        cleanTransmission();
        ch = parseInt(v_height.value)*parseInt(v_units.value);
        canvas.height = ch;
        switch (protocol.value) {
            case 'bro888':
            case 'rgb888':
            oldPort = port.value;
            port.value = '6454';
            break;
            case 'pixzip':
            case 'pixels':
            port.value = oldPort;
            break;
            case 'pixbro':
            port.value = oldPort;
            break;
        }
    };
    
    canvas.width = parseInt(v_width.value);
    canvas.height = parseInt(v_height.value)*parseInt(v_units.value);

    v.addEventListener('play', function(){
      if (!isSocketOpen) {
        openSocket();
      }
      draw(this,context,cw,ch);
    },false);

    v.addEventListener('pause', function(){
        cleanTransmission();
    },false);

    let canvasImage = new Image();
    canvasImage.onload = function() {
        context.drawImage(this, 0, 0, canvas.width, canvas.height);
        drawImage(context,cw,ch);
    }

    let cameraApp = {
       start: function(image_url) {
           video.src = '';
           video.setAttribute('poster', image_url);
            if (!isSocketOpen) {
               openSocket();
            }
            canvasImage.src = image_url;
       },
       error: function(msg) {
        transmission.innerText = msg;
       }
    }

    document.getElementById('v-open').addEventListener('click', function () {
        navigator.camera.getPicture(cameraApp.start, cameraApp.error, cameraConfig)
    });
    document.getElementById('version').innerText = VERSION;
},false);

function sendUdp(bytesToPost) {
    let compressed;
    let t0 = performance.now();
    let t1;
    switch (protocol.value) {
        case 'bro888':
            // 6 bytes header + Compressed data
            let headerBytes = bytesToPost.slice(0,6);
            let data = bytesToPost.slice(headerBytes.length-1, bytesToPost.length);
            compressed = compress(data, data.length, quality.value, lg_window_size);
            let send = new Int8Array(headerBytes.length + compressed.length);
            send.set(headerBytes);
            send.set(compressed, headerBytes.length);
            t1 = performance.now();
            chrome.sockets.udp.send(socketId, send.buffer, ip.value, parseInt(port.value), function(sendInfo) {
                transmission.innerText = sendInfo.bytesSent+" compressed bytes in "+Math.round(t1-t0)+" ms.";
            });
        break;
        case 'pixbro':
            compressed = compress(bytesToPost, bytesToPost.length, quality.value, lg_window_size);
            t1 = performance.now();
            chrome.sockets.udp.send(socketId, compressed.buffer, ip.value, parseInt(port.value), function(sendInfo) {
                transmission.innerText = sendInfo.bytesSent+" compressed bytes in "+Math.round(t1-t0)+" ms.";
            });
        break;
        
        default:
            chrome.sockets.udp.send(socketId, bytesToPost.buffer, ip.value, parseInt(port.value), function(sendInfo) {
                transmission.innerText = "Sending "+sendInfo.bytesSent+" bytes";
            });

        break;
   }

}

function convertChannel(pixels) {
    let pixLength = pixels.length;
    // Line data flow direction
    // ----> Line 1
    // <---- Line 2
    // ----> Line 3  ...
    // ----> Line 12 (module 2)
    let lineCount = 1;
    let cw = parseInt(v_width.value);
    for (var x = 0; x <= pixLength-cw; x=x+cw) {
        // Pair modules are mirrored
        let isModuleImpair = (lineCount <= unitH) ? 0 : 1;
        // Invert pixels in pair lines for this Led matrix 
        if (lineCount % 2 === isModuleImpair) {
            let pixelsInvertedCopy = pixels.slice(x,x+cw);
            pixelsInvertedCopy.reverse();

            let invIndex = 0;
            for (var inv = x; inv <= x+cw-1; inv++) {  
                pixels[inv] = pixelsInvertedCopy[invIndex];
                invIndex++
            }
        }
        lineCount++;
    }
    
    let MSB = parseInt(pixLength/256);
    let LSB = pixLength - (MSB*256);
    headerBytes = 6;
    // Header bytes 
    switch (protocol.value) {
        case 'rgb888':
            hByte = [1,0,0,0,LSB,MSB];
        break;
        case 'bro888':
            hByte = [14,0,0,0,LSB,MSB];
        break;
        default:
            // 1: p  2: Non used  3 Channel   4 Length LSB   5 Length MSB
            hByte = [80,0,0,LSB,MSB];
            headerBytes = 5;
        break;
      }
    //console.log(hByte); // Debug headers
    let bufferLen = (pixLength*3)+headerBytes;
    // create an ArrayBuffer with a size in bytes
    var buffer = new ArrayBuffer(bufferLen);
    var bytesToPost = new Uint8Array(buffer); 
    bi = 0;
    bytesToPost[bi] = hByte[0];bi++;  // p
    bytesToPost[bi] = hByte[1];bi++;  // Future features (not used)
    bytesToPost[bi] = hByte[2];bi++;  // unsigned 8-bit LED channel number
    bytesToPost[bi] = hByte[3];bi++;  // count(pixels) 16 bit, next too
    bytesToPost[bi] = hByte[4];bi++;  // Second part of count(pixels) not used here for now
  if (protocol.value === 'rgb888') {
    bytesToPost[bi] = hByte[5];bi++;
  }
    for (var k = 0; k < pixLength; k++) {
        bytesToPost[bi] = Math.round(pixels[k][0]*v_brightness.value);bi++;
        bytesToPost[bi] = Math.round(pixels[k][1]*v_brightness.value);bi++;
        bytesToPost[bi] = Math.round(pixels[k][2]*v_brightness.value);bi++;
    }

    if (!isSocketOpen) {
      transmission.innerHTML = '<span color="red">Socket is closed: Add IP</span>';
      return;
    }
    sendUdp(bytesToPost);
  }

  
function draw(v,c,w,h) {
    if(v.paused || v.ended) return false;
    c.filter = "contrast("+contrast.value+")";
    c.drawImage(v,0,0,w,h);
    // Read image from canvas
    imageObj = c.getImageData(0, 0, parseInt(v_width.value), parseInt(v_height.value)*parseInt(v_units.value));
    pData = imageObj.data;
    let pixels = new Array;
    // Byte progression is R,G,B,A (We discard the 4th value)
   for (var i = 1; i <= pData.length+3; i ++) {
        
        if (i % 4 === 0) {
            pixels.push([
                pData[i-4],
                pData[i-3],
                pData[i-2],
            ]);
            continue;
        }
    } 
    convertChannel(pixels);
    
    setTimeout(draw,millis_frame.value,v,c,w,h);
}

function drawImage(c,w,h) {
    c.filter = "contrast("+contrast.value+")";
    c.drawImage(v,0,0,w,h);
    // Read image from canvas
    imageObj = c.getImageData(0, 0, parseInt(v_width.value), parseInt(v_height.value)*parseInt(v_units.value));
    pData = imageObj.data;
    let pixels = new Array;
    // Byte progression is R,G,B,A (We discard the 4th value)
   for (var i = 1; i <= pData.length+3; i ++) {

        if (i % 4 === 0) {
            pixels.push([
                pData[i-4],
                pData[i-3],
                pData[i-2],
            ]);
            continue;
        }
    }
    convertChannel(pixels);
}

function openSocket() {
    chrome.sockets.udp.create({}, function(socketInfo) {
        socketId = socketInfo.socketId;
        chrome.sockets.udp.bind(socketId,
            "0.0.0.0", 0, function(result) {
              if (result < 0) {
                console.log("Error binding socket");
                isSocketOpen = false;
                return;
              }
              isSocketOpen = true;
        });
    });
}

(function localFileVideoPlayer() {
	'use strict'
  var URL = window.URL || window.webkitURL
  var displayMessage = function (message, isError) {
    transmission.innerHTML = message
    transmission.className = isError ? 'error' : 'info'
  }
  canvas.width = parseInt(v_width.value);
  canvas.height = ch;
  var playSelectedFile = function (event) {
    var file = this.files[0]
    var type = file.type
    var videoNode = document.querySelector('video')
    var canPlay = videoNode.canPlayType(type)
    if (canPlay === '') canPlay = 'no'
    var message = 'Can play type "' + type + '": ' + canPlay
    var isError = canPlay === 'no'
    displayMessage(message, isError)

    if (isError) {
      return
    }

    var fileURL = URL.createObjectURL(file)
    videoNode.src = fileURL
  }
  var inputNode = document.querySelector('input')
  inputNode.addEventListener('change', playSelectedFile, false)
})()

/**
 * Saves form state to chrome.storage.local
 * @param $form to save in localstorage(jQuery object)
 */
function saveFormState() {
  const form = document.querySelector('form');
  const data = Object.fromEntries(new FormData(form).entries());
  let formJson = JSON.stringify(data);
  storage.setItem('form', formJson);
}
  
/**
* Loads form state from chrome.storage.local
*/
function loadFormState() {
    const formData = storage.getItem('form');
    if (formData == null || typeof formData !== 'string') return;
    formKeyValue = JSON.parse(formData);
    for (var item in formKeyValue) {
        document.getElementsByName(item)[0].value = formKeyValue[item];
    }
}

function cleanTransmission(){
    transmission.innerHTML = t_empty;
    transmission.className = 'white';
}

function validateIp(str, verbose) {
    const octet = '(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]?|0)';
    const regex = new RegExp(`^${octet}\\.${octet}\\.${octet}\\.${octet}$`);
    validIp = regex.test(str);

     if (validIp) {
         if (verbose) transmission.innerText = 'Valid IP';
     } else {
          transmission.innerHTML = '<span color="red">Not a valid IP</span>';
     }
     return validIp;
}
