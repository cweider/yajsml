/*!

  Copyright (C) 2011 Chad Weider

  This software is provided 'as-is', without any express or implied warranty. 
  In no event will the authors be held liable for any damages arising from the
  use of this software.

  Permission is granted to anyone to use this software for any purpose,
  including commercial applications, and to alter it and redistribute it
  freely, subject to the following restrictions:

  1. The origin of this software must not be misrepresented; you must not
     claim that you wrote the original software. If you use this software in
     a product, an acknowledgment in the product documentation would be
     appreciated but is not required.
  2. Altered source versions must be plainly marked as such, and must not be
     misrepresented as being the original software.
  3. This notice may not be removed or altered from any source distribution.

*/

var fs = require('fs');
var pathutil = require('path');
var events = require('events');

var kernelPath = pathutil.join(__dirname, '..', 'kernel.js');
var kernel = 'var require = '
  + fs.readFileSync(kernelPath, 'utf8')
  + 'return require;';

var buildKernel = new Function('XMLHttpRequest', kernel);
var buildMockXMLHttpRequestClass = function (virtualPaths) {
  var emitter = new events.EventEmitter();
  var requestCount = 0;
  var idleTimer = undefined;
  var idleHandler = function () {
    emitter.emit('idle');
  };
  var requested = function (info) {
    clearTimeout(idleTimer);
    requestCount++;
    emitter.emit('requested', info);
  };
  var responded = function (info) {
    emitter.emit('responded', info);
    requestCount--;
    if (requestCount == 0) {
      idleTimer = setTimeout(idleHandler, 0);
    }
  };

  var MockXMLHttpRequest = function () {
  };
  MockXMLHttpRequest.prototype = new function () {
    this.open = function(method, url, async) {
      this.async = async;
      this.url = url;
    }
    this.send = function () {
      var requestPath;
      var path;
      var basePath;
      var realPath;

      var components = this.url.split('/');
      for (var i = 0, ii = components.length; i < ii; i++) {
        components[i] = decodeURIComponent(components[i]);
      }
      requestPath = components.join('/')
      for (var virtualPath in virtualPaths) {
        if (Object.prototype.hasOwnProperty.call(virtualPaths, virtualPath)) {
          var testPath = requestPath.slice(0, virtualPath.length);
          if (testPath == virtualPath) {
            path = requestPath.slice(virtualPath.length, requestPath.length);
            basePath = virtualPaths[virtualPath];
            realPath = pathutil.join(basePath, path);
            break;
          }
        }
      }

      var info = {
        async: !!this.async
      , requestPath: requestPath
      , path: path
      , basePath: basePath
      , realPath: realPath
      };
      requested(info);
      if (!this.async) {
        try {
          this.status = 200;
          this.responseText = fs.readFileSync(realPath);
        } catch (e) {
          this.status = 404;
        }
        this.readyState = 4;
        responded(info);
      } else {
        var self = this;
        fs.readFile(realPath, 'utf8', function (error, text) {
          self.status = error ? 404 : 200;
          self.responseText = text;
          self.readyState = 4;
          var handler = self.onreadystatechange;
          handler && handler();
          responded(info);
        });
      }
    }
  };
  MockXMLHttpRequest.emitter = emitter;

  return MockXMLHttpRequest;
}

function requireForPaths(rootPath, libraryPath) {
  var virtualPaths = {
    root: rootPath
  , library: libraryPath
  };
  var MockXMLHttpRequest = buildMockXMLHttpRequestClass(virtualPaths);
  var mockRequire = buildKernel(MockXMLHttpRequest);
  mockRequire.setRootURI('root');
  mockRequire.setLibraryURI('library');
  mockRequire.emitter = MockXMLHttpRequest.emitter;
  return mockRequire;
}

exports.requireForPaths = requireForPaths;
