let VERSION = '1.0.8';

let d = document;
let v = d.getElementById('video');
let canvas = d.getElementById('c');
let context = canvas.getContext('2d');
let ip = d.getElementById('esp32_ip'),
    port = d.getElementById('udp_port'),
    contrast = d.getElementById('v_contrast'),
    v_width  = d.getElementById('v_width'),
    v_height = d.getElementById('v_height'),
    v_units  = d.getElementById('v_units'),
    video_c = d.getElementById('video-c'),
    video_select = d.getElementById('video_select'),
    millis_frame = d.getElementById('millis_frame'),
    protocol = d.getElementById('protocol'),
    transmission = d.getElementById('transmission'),
    wifi_msg = d.getElementById('wifi_msg'),
    quality = d.getElementById('bro_quality'),
    v_brightness = d.getElementById('v_brightness'),
    wifi_store = d.getElementById('wifi_store'),
    wifi_ssid = d.getElementById('wifi_ssid'),
    wifi_pass = d.getElementById('wifi_pass');
let socketId, ble_id, ble_type, ble_name;
let cw = parseInt(v_width.value),
    ch = parseInt(v_height.value)*parseInt(v_units.value),
    unitH = parseInt(v_height.value);
    console.log('cw:'+cw);
let storage = window.localStorage;
let isSocketOpen = false;
let configTab = d.getElementById('udpx-tab'),
    device_list = d.getElementById('device_list');

let ble_service_uuid = '0000aaaa-ead2-11e7-80c1-9a214cf093ae';
let ble_wifi_uuid = '00005555-ead2-11e7-80c1-9a214cf093ae';
let tabsCollection = configTab.getElementsByTagName('A');
// typescript doesn't polyfill lib entries
if (!Object.entries) {
  Object.entries = function( obj ){
    var ownProps = Object.keys( obj ),
        i = ownProps.length,
        resArray = new Array(i); // preallocate the Array
    while (i--)
      resArray[i] = [ownProps[i], obj[ownProps[i]]];
    return resArray;
  };
}

// DOMContentLoaded   -> deviceready for cordova
d.addEventListener('deviceready', function(){

    let cameraConfig = {
      quality:50,
      destinationType: Camera.DestinationType.FILE_URI,
      sourceType: Camera.PictureSourceType.CAMERA,
      mediaType: Camera.MediaType.VIDEO,
      encodingType: Camera.EncodingType.JPEG,
      cameraDirection: Camera.Direction.BACK
    };
    // Bootstrap tabsCollection
    for (var i = 0; i < tabsCollection.length; i++) {
      new Tab(tabsCollection[i],
      {
        height: true
      });
    }

    var zeroconf = cordova.plugins.zeroconf;
    zeroconf.registerAddressFamily = 'ipv4';
    zeroconf.watchAddressFamily = 'ipv4';
    zeroconf.getHostname(function success(hostname){
        console.log(hostname); // ipad-of-becvert.local.
    });
    console.log('discover: mDns')
   zeroconf.watch('_http._tcp.', 'local.', function(result) {
   console.log(result)
       var action = result.action;
       var service = result.service;
       if (action == 'added') {
           console.log('service added', service);
       } else if (action == 'resolved') {
           console.log('service resolved', service);
       } else {
           console.log('service removed', service);
       }
   });

    // Start - EventListeners
    loadFormState()

    d.getElementById('vt-tab').onclick = function() {
     video_c.style.display = 'block';
    }
    d.getElementById('ct-tab').onclick = function() {
     video_c.style.display = 'block';
    }
    d.getElementById('main-form').onchange = function() {
        saveFormState();
    };

    if (validateIp(ip.value, true)) {
      openSocket();
    }

    // Send udp message
    d.getElementById('send_udp').onclick = function() {
        udp_text = d.getElementById('udp_text').value;
        udp_buf = str2buffer(udp_text);
        chrome.sockets.udp.send(socketId, udp_buf , ip.value, parseInt(port.value), function() {
            transmission.innerText = "Sending "+ udp_text;
        });
        return false;
    };

    wifi_store.onchange = function() {
       if (wifi_store.checked) {
          transmission.innerHTML = '<span style="color:red"><b>Security:</b> When you are done leave this unchecked</span>';
       } else {
          transmission.innerText = 'Thanks! Password was removed from local storage'
       }
    }

    // Blue App
    let blue = {
        list: function() {
            video_c.style.display = 'none';
            device_list.innerHTML = '';

            ble.startScan([], blue.onDiscoverBle, function(error) {
               console.log(error);
            });

            setTimeout(ble.stopScan, 1000,
                function() {
                console.log('bluetoothSerial.list');
                bluetoothSerial.list(
                    function(bs) {
                        for (var i in bs) {
                            blue.addDevice(bs[i], 'serial')
                        }
                        d.getElementById('ble_msg').innerText = 'Press to configure WiFi';
                    },
                    function(error) {
                        console.log(JSON.stringify(error));
                    }
                );
                }, function() {}
            );
        },
        onDiscoverBle: function(device) {
            // Filter devices starting by ESP*
            if (typeof(device.name) !== 'undefined' && device.name.match(/ESP/i)) {
                blue.addDevice(device, 'ble')
            }
        },
        notEnabled: function() {
            blue.showError('BLUETOOTH IS NOT ENABLED');
        },

        addDevice: function (device, typ) {
            var listItem = d.createElement('button'),
                html =  device.name + ' ' + device.id;
            listItem.setAttribute('class', 'form-control btn btn-default active');
            listItem.setAttribute('type', 'button');
            listItem.dataset.id = device.id;
            listItem.dataset.type = typ;
            listItem.dataset.name = device.name;
            listItem.innerHTML = html;

            listItem.onclick = function(b) {
                ble_id = b.target.getAttribute('data-id');
                ble_type = b.target.getAttribute('data-type');
                ble_name = b.target.getAttribute('data-name');
                wifi_msg.innerText = "Target: "+ble_name;
                let wifiTabInit = tabsCollection[4].Tab;

                bluetoothSerial.isConnected(blue.disconnect, blue.connect);

                wifiTabInit.show();
                return false;
            };
            device_list.appendChild(listItem);
        },

        sendMessage: function(message) {
            if (ble_type === 'serial') {
              bluetoothSerial.write(message+ "\n");
            } else {
              let ble_msg = str2buffer(message);
              ble.write(ble_id, ble_service_uuid, ble_wifi_uuid, ble_msg, blue.display, blue.showError);
            }

        },
        connect: function() {
            if (ble_type === 'serial') {
                    console.log("serial: connecting to "+ble_id)
                    bluetoothSerial.connect(
                        ble_id,         // device to connect
                        blue.openPort,  // start listening
                        blue.showError
                    );
                } else {
                    ble.connect(ble_id, blue.openPort, blue.disconnect);
                }
        },
        connectForIp: function() {
                    if (ble_type === 'serial') {
                            bluetoothSerial.connect(
                                ble_id,         // device to connect
                                blue.openPortForIp,  // start listening
                                blue.showError
                            );
                        } else {
                            ble.connect(ble_id, blue.openPortForIp, blue.disconnect);
                        }
                },
        disconnect: function () {
             console.log("Disconnecting "+ble_id)
             if (ble_type === 'serial') {
                    bluetoothSerial.disconnect(
                        blue.closePort,     // stop listening to the port
                        blue.showError      // show the error if you fail
                    );
                } else {
                    ble.disconnect(
                        blue.closePort,     // stop listening to the port
                        blue.showError      // show the error if you fail
                    );
                }
        },
        openPort: function() {
            if (ble_type === 'serial') {
                bluetoothSerial.subscribe('\n', function (data) {
                    blue.displayClear();
                    blue.display(data);
                });
            }
        },
        openPortForIp: function() {

                    if (ble_type === 'serial') {
                    console.log('openPortForIp and subscribing')
                        bluetoothSerial.subscribe('\n', function (data) {
                            blue.displayClear();
                            blue.display(data);
                        });

                        blue.sendMessage('{"getip":"true"}')
                    //setTimeout(function(){  }, 500);

                    }
                },
        closePort: function() {
            console.log('closePort')
            if (ble_type === 'serial') {
                bluetoothSerial.unsubscribe(
                        function (data) {
                            blue.display(data);
                        },
                        blue.showError
                );
            }
        },
        showError: function(error) {
            wifi_foot_msg.innerHTML = '<span color="red"><b>'+ error +'</b></span>';
        },
        display: function(message) {
            lineBreak = document.createElement("br"),
            label = document.createTextNode(message);
             wifi_foot_msg.appendChild(lineBreak);
             wifi_foot_msg.appendChild(label);
        },
        displayClear: function() {
            wifi_foot_msg.innerHTML = "";
        },
        start: function() {
           bluetoothSerial.isEnabled(
                    blue.list,
                    blue.notEnabled
           );
        }
     };

      d.getElementById('ble-tab').onclick = function() {
        blue.displayClear();
        blue.start();
        return false;
      }
      d.getElementById('ble_reset').onclick = function() {
         blue.displayClear();
         blue.sendMessage('{"reset":"true"}');
         return false;
      }
      d.getElementById('ble_erase').onclick = function() {
         blue.displayClear();
         blue.sendMessage('{"erase":"true"}');
         return false;
      }
      d.getElementById('ble_getip').onclick = function() {
         bluetoothSerial.isConnected(blue.disconnect, blue.connectForIp);
         return false;
      }

    // Send WiFi configuration to ESP32
    ble_set_config.onclick = function() {
         blue.sendMessage('{"ssidPrim":"'+wifi_ssid.value+'","pwPrim":"'+wifi_pass.value+'","ssidSec":"ssid2","pwSec":""}');

         return false;
    }

    video_select.onchange = function() {
        if (video_select.value !== '') {
            cleanTransmission();
            v.setAttribute('src','video/'+video_select.value);
            ch = parseInt(v_height.value)*parseInt(v_units.value);
            canvas.width = parseInt(v_width.value);
            canvas.height = ch;
            console.log('width:'+canvas.width)
        }
    };
    ip.onchange = function() {
        cleanTransmission();
    };
    port.onchange = function() {
        cleanTransmission();
    };
    v_width.onchange = function() {
            cleanTransmission();
            cw = parseInt(v_width.value)
            canvas.width = cw
        }
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
        saveFormState();
        cleanTransmission();
        ch = parseInt(v_height.value)*parseInt(v_units.value);
        canvas.height = ch;
        switch (protocol.value) {
            case 'bro888':
            case 'rgb888':
                oldPort = port.value;
                port.value = '6454';
            break;
            default:
                if (typeof oldPort !== "undefined") {
                    port.value = oldPort;
                }
            break;
        }
    };
    
    canvas.width = parseInt(v_width.value);
    canvas.height = parseInt(v_height.value)*parseInt(v_units.value);

    v.addEventListener('play', function(){
        cw = parseInt(v_width.value)
        ch = parseInt(v_height.value)*parseInt(v_units.value)
      if (!isSocketOpen) {
        openSocket();
      }
      if (validateIp(ip.value, true)) {
        draw(this,context,cw,ch);
      }

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
           v.src = '';
           v.setAttribute('poster', image_url);
            if (!isSocketOpen) {
               openSocket();
            }
            canvasImage.src = image_url;
       },
       error: function(msg) {
        transmission.innerText = msg;
       }
    }

    d.getElementById('v-open').addEventListener('click', function () {
        navigator.camera.getPicture(cameraApp.start, cameraApp.error, cameraConfig)
    });
    d.getElementById('version').innerText = VERSION;
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
      transmission.innerHTML = '<span style="color:red">Socket is closed: Add IP</span>';
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
    var canPlay = v.canPlayType(type)
    if (canPlay === '') canPlay = 'no'
    var message = 'Can play type "' + type + '": ' + canPlay
    var isError = canPlay === 'no'
    displayMessage(message, isError)

    if (isError) {
      return
    }

    var fileURL = URL.createObjectURL(file)
    v.setAttribute('poster', '')
    v.src = fileURL
  }
  var inputNode = d.querySelector('input')
  inputNode.addEventListener('change', playSelectedFile, false)
})()

/**
 * Saves form state to chrome.storage.local
 * @param $form to save in localstorage(jQuery object)
 */
function saveFormState() {
  const form = d.querySelector('form');
  const data = objectFromEntries(new FormData(form).entries());
  if (!wifi_store.checked) {
     data.wifi_pass = '';
  }
  let formJson = JSON.stringify(data);
  storage.setItem('form', formJson);
  storage.setItem('protocol', protocol.value);
}
  
/**
* Loads form state from chrome.storage.local
*/
function loadFormState() {
    const formData = storage.getItem('form');
    if (formData == null || typeof formData !== 'string') return;
    formKeyValue = JSON.parse(formData);
    for (var item in formKeyValue) {
        d.getElementsByName(item)[0].value = formKeyValue[item];
    }
    dropdownSet(protocol, storage.getItem('protocol'));
}

function cleanTransmission(){
    transmission.innerHTML = '';
    transmission.className = 'white';
}

function validateIp(str, verbose) {
    const octet = '(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]?|0)';
    const regex = new RegExp(`^${octet}\\.${octet}\\.${octet}\\.${octet}$`);
    validIp = regex.test(str);
     if (validIp) {
         if (verbose) transmission.innerText = 'Valid IP';
         ip.style.borderColor = "black";
     } else {
          transmission.innerHTML = '<span color="red">Not a valid IP</span>';
          let configTabInit = tabsCollection[1].Tab;
          let isConfigTab = d.getElementById('ct-tab').getAttribute('aria-expanded');
          if (isConfigTab === 'false') {
            configTabInit.show();
          }
          ip.style.borderColor = "red";
     }
     return validIp;
}

// Polyfill for Object.fromEntries()
function objectFromEntries(iter) {
  const obj = {};
  for (const pair of iter) {
    if (Object(pair) !== pair) {
      throw new TypeError('iterable for fromEntries should yield objects');
    }
    const { '0': key, '1': val } = pair;
    Object.defineProperty(obj, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: val,
    });
  }
  return obj;
}
// source: http://stackoverflow.com/a/11058858
function str2buffer(str) {
  var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
  var bufView = new Int8Array(buf);
  for (var i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}
// Form helpers
function dropdownSet(selectObj, valueToSet) {
    for (var i = 0; i < selectObj.options.length; i++) {
        if (selectObj.options[i].value == valueToSet) {
            selectObj.options[i].selected = true;
            return;
        }
    }
}