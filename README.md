![udpx Logo](http://udpx.fasani.de/udpx-logo.png)

**udpx is a technology to transport data over WiFi to microcontrollers**


### What it can be used for

1. Send a picture over WiFi to a LED controller with [ESP32 udpx firmware](https://github.com/martinberlin/udpx) or [Remora](https://github.com/martinberlin/Remora)
2. Send over the air Video frames. 

Note that Remora supports only plain Pixels without any compression. udpx supports zlib and brotli as compression algorithms.
Up to 1000 RGB pixels. The ESP32 has a maximum transport unit (MTU) of 1470 bytes and we are not doing buffering on the Firmware side, so using Zlib or Brotli compression 1000 pixels is the limit where you can still get a decent framerate.

## Android App latest builds

If you want to test this fast using Android, just download and install the udpx app from Play store:
<a href="https://play.google.com/store/apps/details?id=io.cordova.udpx" />
<img src="https://github.com/martinberlin/udpx/raw/master/examples/udpx-app-180x120.jpg" />
[udpx esp32](https://play.google.com/store/apps/details?id=io.cordova.udpx)


Luckycloud cloudstorage hosts the latest APK builds, if you want to check latest unstable features first uninstall the App, and download:

[Latest signed APK release](https://storage.luckycloud.de/d/0c007c42956746c186a1/?p=/android/releases&mode=list)

And install it on your Android phone after giving it the necessary permissions. We recommend to use only the stable Play store versions.

This application sends RGB pixels to ESP32 controllers. We are using canvas to render video and read the pixels to be send as binary data to the ESP32.
To accomplish that mission the ESP32 controllers should be running our UDPX Firmware or alternatively [OctoWifi firmware](https://github.com/spectrenoir06/OctoWifi-LEDs-Controller)
Protocols supported:

   * Pixels
   * PIX565 (uses 2 bytes per pixel) Needs udpx Firmware in latest version [on feature/16-pix565 branch](https://github.com/martinberlin/udpx/tree/feature/16-pix565)
   * RGB565
   * BRO888
   
Last two are meant to be used with [OctoWiFi](https://github.com/spectrenoir06/OctoWifi-LEDs-Controller) Led controller Firmware. 

iOS /iPad version is not going to see the light at least this year. I'm reluctant to buy a Mac just for this, so anyone taking the task is greatly welcome. 
If you need any other platform, feel free to clone this, and make it your own. To check upcoming features just open the [Issues board](https://github.com/martinberlin/udpx-app/issues).

## Dependencies

udpx-app uses offers both BLE and Bluetooth-serial WiFi configuration using this great plugins:
https://github.com/don/BluetoothSerial
https://github.com/don/cordova-plugin-ble-central

## UDPX ESP32 Firmware

This is a companion App to send binary data via WiFi to ESP32 Led controllers. To compile the Firmware please refer to:

[udpx Firmware in github](https://github.com/martinberlin/udpx)

We use PlatformIO as a Visual Code IDE to upload this into the Espressif chip and we recommend to compile it this way.

## UDPX recommended Hardware to display video

The firmware supports any RGB addressable leds to do this (WS2812B or similar). A practical way to display video is to adquire a Led Matrix that comes already built.
Please check our [hardware buying guide](https://github.com/martinberlin/udpx/wiki/Hardware-buying-guide) before buying the gear to build a Led Matrix.
Note that the data flow on the horizontal lines on most of this panels is like this:

1. --> right. This is important the data IN should be on the top left of the Led Matrix and flow down
2. <-- left (pixels in this one should be reversed before sending)
3. --> and so on.

    IN_______  1st Led Matrix
    ->|      | Row 1 ->
      |______| Row 2 <-
            -> OUT connected to IN in 2nd
    IN_______  2nd Led Matrix
    ->|      | Row 1 ->
      |______| Row 2 <-

So this App takes care of doing the sort(2) in your client before sending the bytes. It supports only this data flow at the moment, and stacking Led Matrixes one below the other, so if you are planning to build a video wall using linear Led stripes make sure to follow suit.
Is actually the most easy way to do it, otherwise you should wire the data from right corner on every end of line to the left of the next one, so for simplicity is done this way. Make sure that in the Led Matrix you adquire the data flows horizontally in the larger width (Ex. 44 width, 11 height)
This App reads the canvas horizontally, from top-left to right, and streams like this to the Firmware without making any rearranging except of inversing the pair lines. The udpx Firware does not have a clue of what Matrix you use, it just pushes next UDP packet after processing via Neopixels to the Led. 

## Licensing

This App is open source and you can make it your own as long as you respect the copyright ownership of UDPX.
If you want to use it commercially is also no problem but please write a short message to see where it will be used so we can follow the project.
