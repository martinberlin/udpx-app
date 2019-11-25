![udpx Logo](http://udpx.fasani.de/udpx-logo.png)

**udpx is a technology to transport data over WiFi to microcontrollers**

## Latest builds

Luckycloud cloudstorage hosts the latest APK builds, just download:

[app-debug.apk](https://storage.luckycloud.de/d/0c007c42956746c186a1/?p=/android)

And install it on your Android phone after giving it the necessary permissions.
iOS /iPad version is comming soon, also a Windows/Linux build, if you want to use it on your PC.
If you need any other platform, feel free to clone this, and make it your own.

## Android App

This is my humble intent to build in the first version a very easy hybrid App using Cordova to send RGB pixels to ESP32 controllers.
We are using canvas to render video, pixels are readed, compressed and send as binary data to the ESP32.

The ESP32 controllers should be running our UDPX Firmware or alternatively [OctoWifi firmware](https://github.com/spectrenoir06/OctoWifi-LEDs-Controller)

## UDPX Firmware

This is a companion App to send bynary data via WiFi to ESP32 Led controllers. To compile the Firmware please refer to:

[UDPX Firmware in github](https://github.com/martinberlin/udpx/tree/develop)

We use PlatformIO as a Visual Code IDE to upload this into the Espressif chip and we recommend to compile it this way.

## UDPX Hardware

You can actually use any RGB addressable leds to do this (WS2812B or similar). A practical way to display video is to adquire a Led Matrix that comes already built.
In Alixpress there is a firma called BTF-Lighting that has awesome 22*22 or 44*11 panels that offer 484 RGB pixels

1. https://www.aliexpress.com/item/32945260788.html
2. https://www.amazon.com/BTF-LIGHTING-0-48ft0-48ft-Flexible-Individually-addressable/dp/B01DC0IOCK/

In Amazon you can find this too, but not so big, and probably more expensive. Note that the data flow on most of this panels is:

--> right
<-- left
--> and so on.

So this App takes care of doing the sort in your client before sending the bytes. It supports only this data flow at the moment, so if you are planning to build a video wall using linear Led stripes make sure to follow suit.
Is actually the most easy way to do it, otherwise you should wire the data from right corner to the left in every line jump, so for simplicity is done this way.
Make sure to connect this properly to a proper 5V power supply (USB is ok for testing only) and the data wire on the middle to ESP32 GPIO 19 as specified in UDPX Firmware.



## Licensing

This App is open source and you can make it your own as long as you respective the copyright ownership of UDPX.
If you want to use it commercially is also no problem but please write a short message to see where it will be used so we can follow the project.