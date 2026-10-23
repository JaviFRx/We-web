# LEGO-WeDo-Content-Viewer

## Description

Angular 1.4 project that is an integral part of LEGO WeDo rendered within a web view shown in the WeDo Unity app. See Content-Tool project for content authoring.

The project should have responsive design supporting different screen sizes.

It should be compatible with multiple browsers: IE11/Edge, latest Chrome, latest Webkit.

The following platforms are supported:
- Windows 7/8/10 - native web view using Internet Explorer 11/Edge features/compatibility
- iOS - custom UniWebView 2 based component using
- Chrome - Chrome
- OSX - webkit based webview

Frameworks/tools used: Angular 1.4, Npm, Bower, Grunt, Less

## Building

- Run build:
npm run build
Compiled project will be saved in build directory

## Local testing

- Run continous build:
npm run build:watch

- Install http server if necessary:
npm i -g http-server if not installed)

- Run http server in root directory:
./http-server

- Go to development page:
open http://localhost:8080/developerindex.html


## Adding graphics

Use images directory


