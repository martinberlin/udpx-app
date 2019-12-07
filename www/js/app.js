let VERSION = '1.1.21';

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
    quality = d.getElementById('bro_quality'),
    v_brightness = d.getElementById('v_brightness'),
    wifi_store = d.getElementById('wifi_store'),
    wifi_ssid = d.getElementById('wifi_ssid'),
    wifi_pass = d.getElementById('wifi_pass'),
    wifi_msg = d.getElementById('wifi_msg'),
    wifi_pre = d.getElementById('wifi_pre');
let socketId, ble_id, ble_type, ble_name, ble_mac = '', ble_enabled = true;
let cw = parseInt(v_width.value),
    ch = parseInt(v_height.value)*parseInt(v_units.value),
    unitH = parseInt(v_height.value);

let storage = window.localStorage;
let isSocketOpen = false;
let config_tab = d.getElementById('udpx-tab'),
    disco_tab = d.getElementById('disco-tab'),
    disco_msg = d.getElementById('disco_msg'),
    device_list_paired = d.getElementById('device_list_paired'),
    device_list_unpaired = d.getElementById('device_list_unpaired'),
    discovery_list = d.getElementById('discovery_list'),
    discovery_enabled = false;

let ble_service_uuid = '0000aaaa-ead2-11e7-80c1-9a214cf093ae';
let ble_wifi_uuid = '00005555-ead2-11e7-80c1-9a214cf093ae';
let tabsCollection = config_tab.getElementsByTagName('A');
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
        height: false
      });
    }
    // mDns discovery
    var zeroconf = cordova.plugins.zeroconf;
    zeroconf.registerAddressFamily = 'ipv4';
    zeroconf.watchAddressFamily = 'ipv4';

    // Start - EventListeners
    loadFormState()

    d.getElementById('vt-tab').onclick = function() {
     video_c.style.display = 'block';
    }
    d.getElementById('ct-tab').onclick = function() {
     video_c.style.display = 'block';
     validateIp(ip.value, false);
    }
    d.getElementById('main-form').onchange = function() {
        saveFormState();
    };

    if (validateIp(ip.value, true)) {
      openSocket();
    }

    // Send udp message
    d.getElementById('send_udp').onclick = function() {
        if (validateIp(ip.value, true)) {
            if (!isSocketOpen) {
                openSocket();
              }
            udp_text = d.getElementById('udp_text').value;
            udp_buf = str2buffer(udp_text);
            chrome.sockets.udp.send(socketId, udp_buf , ip.value, parseInt(port.value), function() {
                transmission.innerText = "Sending "+ udp_text;
            });
        }
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
            device_list_paired.innerHTML = '';
            device_list_unpaired.innerHTML = '';
            d.getElementById('ble_msg_foot').innerText = '';
            ble.startScan([], blue.onDiscoverBle, function(error) {
               ble_msg.innerText = error;
            });

            setTimeout(ble.stopScan, 1000,
                function() {
                bluetoothSerial.list(
                    function(bs) {
                        d.getElementById('ble_msg').innerText = 'Bluetooth scan. Select target:';
                        for (var i in bs) {
                            blue.addDevice(bs[i], 'serial', true)
                        }

                        bluetoothSerial.discoverUnpaired(function(bs) {
                             for (var i in bs) {
                                 blue.addDevice(bs[i], 'serial', false)
                             }
                         }, function(error) {
                                d.getElementById('ble_msg_foot').innerText = JSON.stringify(error);
                            });
                    },
                    function(error) {
                        d.getElementById('ble_msg_foot').innerText = JSON.stringify(error);
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
            ble_enabled = false;
            blue.showError('BLUETOOTH IS NOT ENABLED');
        },
        removeDiscovery: function (service) {
            if (typeof d.getElementById(service.name) == 'undefined') return;
            d.getElementById(service.name).remove();
        },
        addDiscovery: function (service) {
            if (service.ipv4Addresses.length === 0) return;
            let buttonClass = 'btn-default';
            //console.log(service.name,ble_mac,service.name.indexOf(ble_mac))
            if (ble_mac !== '' && service.name.indexOf(ble_mac) !== -1) {
                buttonClass = 'btn-success';
            };

            var service_item = d.createElement('button');
            service_item.setAttribute('class', 'form-control btn active '+ buttonClass);
            service_item.setAttribute('type', 'button');
            service_item.setAttribute('id', service.name);
            service_item.dataset.ip = service.ipv4Addresses[0];

            // try to guess port from name_PORT if name is formatted correctly
            name_parts = service.name.split('_');

            if (name_parts.length>1) {
               service_item.dataset.port = name_parts[1];
            } else {
               service_item.dataset.port = '';
            }

            service_item.innerHTML = service.name;

            service_item.onclick = function(b) {
                ip.value = b.target.getAttribute('data-ip');
                if (b.target.getAttribute('data-port').length) {
                 port.value = b.target.getAttribute('data-port');
                }
                let port_part = (port.value !== '') ? ':'+port.value : '';
                disco_msg.innerText = "Setting IP to "+ip.value+port_part;
                blue.discoveryDisable();
                return false;
            };
            discovery_list.appendChild(service_item);
        },
        addDevice: function (device, typ, paired = false) {
            device_mac = (typeof device.address !== 'undefined') ? device.address.replace(/:/g,'') :'';
            var listItem = d.createElement('button');
            listItem.setAttribute('class', 'form-control btn btn-default active');
            listItem.setAttribute('type', 'button');
            listItem.dataset.id = device.id;
            listItem.dataset.type = typ;
            listItem.dataset.name = device.name;
            listItem.dataset.mac = device_mac.substring(0,10);
            listItem.innerHTML = device.name;
            listItem.onclick = function(b) {
                ble_id = b.target.getAttribute('data-id');
                ble_type = b.target.getAttribute('data-type');
                ble_name = b.target.getAttribute('data-name');
                ble_mac = b.target.getAttribute('data-mac');
                wifi_msg.innerText = "Target: "+ble_name;
                let wifiTabInit = tabsCollection[4].Tab;
                blue.startConnection();
                wifiTabInit.show();
                return false;
            };
            if (paired) {
              device_list_paired.appendChild(listItem);
            } else {
              device_list_unpaired.appendChild(listItem);
            }

        },
        discoveryEnable: function() {
           discovery_enabled = true;
           zeroconf.watch('_http._tcp.', 'local.', function(result) {
                var action = result.action;
                var service = result.service;
                switch (action) {
                   case 'resolved':
                     blue.addDiscovery(service);
                     break;
                   case 'removed':
                     blue.removeDiscovery(service);
                     break;
                     }
                if (ble_mac !== '') {
                   disco_msg.innerHTML = 'Last connected: <span style="color:green">'+ble_mac+'</span>';
                }
           });
        },
        discoveryDisable: function() {
            discovery_enabled = false;
            zeroconf.unwatch('_http._tcp.', 'local.',
            function() {},function(error) {
               disco_msg.innerText = 'unwatch error:'+error;
            });
        },
        sendMessage: function(message) {
            if (ble_type === 'serial') {
              bluetoothSerial.write(message+ "\n");
            } else {
              let ble_msg = str2buffer(message);
              ble.write(ble_id, ble_service_uuid, ble_wifi_uuid, ble_msg, blue.display, blue.showError);
            }

        },
        startConnection: function() {
            bluetoothSerial.isEnabled(
                bluetoothSerial.isConnected(blue.disconnect, blue.connect),
                blue.notEnabled
            );
        },
        connect: function() {
            if (ble_type === 'serial') {
                    d.getElementById('ble_msg_foot').innerText = "serial: connecting to "+ble_id;
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
                        bluetoothSerial.subscribe('\n', function (data) {
                            blue.displayClear();
                            blue.display(data);
                        });

                        blue.sendMessage('{"getip":"true"}')
                    }
                },
        closePort: function() {
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
        showPreload: function(el) {
            el.style.visibility = 'visible';
        },
        hidePreload: function(el) {
            el.style.visibility = 'hidden';
        },
        postWifiSend: function(){
            blue.hidePreload(wifi_pre);
            wifi_msg.innerHTML = 'Check on the antenna tab please';
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

    // Send WiFi configuration to ESP32
    ble_set_config.onclick = function() {
        if (wifi_ssid.value !== '' && wifi_pass.value !== '') {
             blue.sendMessage('{"ssidPrim":"'+wifi_ssid.value+'","pwPrim":"'+wifi_pass.value+'","ssidSec":"ssid2","pwSec":""}');
             wifi_msg.innerText = "Sending AP to "+ble_name;
             blue.showPreload(wifi_pre);
             setTimeout(blue.postWifiSend, 5000);
        } else {
           wifi_msg.innerHTML = '<span style="color:red">Please set a valid SSID and password</span>';
        }
        if (wifi_ssid.value === '') {
           wifi_ssid.style.borderColor = "red";
        } else {
           wifi_ssid.style.borderColor = "black";
        }
        if (wifi_pass.value === '') {
           wifi_pass.style.borderColor = "red";
        } else {
           wifi_pass.style.borderColor = "black";
        }

        return false;
    }

    video_select.onchange = function() {
        if (video_select.value !== '') {
            cleanTransmission();
            v.setAttribute('src','video/'+video_select.value);
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
    // Discovery of .local
    disco_tab.onclick = function() {
      blue.discoveryEnable();
    }
    disco_tab.click();

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
                transmission.innerText = "Error binding socket";
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