/*

  Copyright (C) 2011 Chad Weider

  This software is provided 'as-is', without any express or implied
  warranty.  In no event will the authors be held liable for any damages
  arising from the use of this software.

  Permission is granted to anyone to use this software for any purpose,
  including commercial applications, and to alter it and redistribute it
  freely, subject to the following restrictions:

  1. The origin of this software must not be misrepresented; you must not
     claim that you wrote the original software. If you use this software
     in a product, an acknowledgment in the product documentation would be
     appreciated but is not required.
  2. Altered source versions must be plainly marked as such, and must not be
     misrepresented as being the original software.
  3. This notice may not be removed or altered from any source distribution.

*/

var fs = require('fs');
var urlutil = require('url');
var pathutil = require('path');
var requestURL = require('./request').requestURL;

function hasOwnProperty(o, k) {
  return Object.prototype.hasOwnProperty.call(o, k);
}

function toJSLiteral(object) {
  // Remember, JSON is not a subset of JavaScript. Some line terminators must
  // be escaped manually.
  var result = JSON.stringify(object);
  result = result.replace('\u2028', '\\u2028').replace('\u2029', '\\u2029');
  return result;
}

function mixin(object1, object2, objectN) {
  var object = {};
  for (var i = 0, ii = arguments.length; i < ii; i++) {
    var o = arguments[i];
    for (var key in o) {
      if (hasOwnProperty(o, key)) {
        object[key] = o[key];
      }
    }
  }
  return object;
}

function selectProperties(o, keys) {
  var object = {};
  for (var i = 0, ii = keys.length; i < ii; i++) {
    var key = keys[i];
    if (hasOwnProperty(o, key)) {
      object[key] = o[key];
    }
  }
  return object;
}

function capitalizeKeys(o) {
  var object = {};
  for (var key in o) {
    if (hasOwnProperty(o, key)) {
      var capitalizedKey = key.replace(/(^|-)([^-])/g, function (m, s, w) {
        return s + w.toUpperCase();
      });
      object[capitalizedKey] = o[key];
    }
  }
  return object;
}

function validateURI(uri) {
  var parsed = urlutil.parse(uri);
  if (parsed.protocol != 'file:'
      && parsed.protocol != 'http:'
      && parsed.protocol != 'https:') {
    throw "Invalid URI: " + JSON.stringify(uri) + ".";
  }
}

/*
  I implement a JavaScript module server.
*/
function Server(options) {
  if (options.rootURI) {
    this._rootURI = options.rootURI.replace(/[\/]+$/,'');
    validateURI(this._rootURI);
    if (options['rootPath'] || options['rootPath'] == '') {
      this._rootPath = options.rootPath.toString();
    } else {
      this._rootPath = 'root';
    }
  }

  if (options.libraryURI) {
    this._libraryURI = options.libraryURI.replace(/[\/]+$/,'');
    validateURI(this._rootURI);
    if (options['libraryPath'] || options['libraryPath'] == '') {
      this._libraryPath = options.libraryPath.toString();
    } else {
      this._libraryPath = 'library';
    }
  }

  if (this._rootPath && this._libraryPath
      && (this._rootPath.indexOf(this._libraryPath) == 0
        || this._libraryPath.indexOf(this._rootPath) == 0)) {
    throw "The paths " + JSON.stringify(this._rootPath) + " and " +
        JSON.stringify(this._libraryPath) + " are ambiguous.";
  }
}
Server.prototype = new function () {
  function handle(request, response) {
    var url = require('url').parse(request.url, true);
    var parts = pathutil.normalize(url.pathname).split('/').slice(1);
    var path = '/' + parts.slice(1).join('/');
    var source = parts[0];

    var resourceURI = null;
    if (source == this._rootPath) {
      resourceURI = this._rootURI + path;
    } else if (this._libraryURI && source == this._libraryPath) {
      resourceURI = this._libraryURI + path;
    } else {
      // Something has gone wrong.
    }

    var requestHeaders = mixin({
          'User-Agent': 'yajsml'
        , 'Accept': '*/*'
        }
      , selectProperties(
          capitalizeKeys(request.headers)
        , ['If-Modified-Since', 'Cache-Control']
        )
      );

    if (request.method != 'HEAD' && request.method != 'GET') {
      // I don't know how to do this.
      response.writeHead(405, {'Allow': 'HEAD, GET'});
      response.write("405: Only the HEAD or GET methods are allowed.")
      response.end();
    } else if (!('callback' in url.query)) {
      // I respond with a straight-forward proxy.
      requestURL(resourceURI, 'GET', requestHeaders,
        function (status, headers, content) {
          var responseHeaders = selectProperties(
              headers
            , ['Date', 'Last-Modified', 'Cache-Control', 'Content-Type']
            );
          response.writeHead(status, responseHeaders);
          if (request.method == 'GET') {
            content && response.write(content);
          }
          response.end();
        }
      );
    } else {
      var JSONPCallback = url.query['callback'];
      if (JSONPCallback.length == 0) {
        response.writeHead(400, {});
        response.write("400: The parameter `callback` must be non-empty.")
        response.end();
        return;
      }

      var modulePath = path;
      if (source == 'library') {
        modulePath = modulePath.replace(/^\//, '');
      }

      var respond = function (status, headers, content) {
        var responseHeaders = mixin(
            selectProperties(
              headers
            , ['Date', 'Last-Modified', 'Cache-Control', 'Content-Type']
            )
          , {
              'Content-Type': 'application/javascript; charset=utf-8'
            }
          );

        if (status == 304) {
          response.writeHead(status, responseHeaders);
          response.end();
        } else {
          if (request.method == 'GET') {
            var definition;
            if (status == 200) {
              definition =
                'function (require, exports, module) {\n' + content + '\n}';
            } else {
              definition = 'null';
            }

            content =
                JSONPCallback + '({\n'
                + toJSLiteral(modulePath) + ': ' + definition
                + '\n});\n'
                ;
          }


          response.writeHead(200, responseHeaders);
          if (request.method == 'GET') {
            content && response.write(content);
          }
          response.end();
        }
      };

      requestURL(resourceURI, 'HEAD', requestHeaders,
        function (status, headers, content) {
          if (status == 304) { // Skip the content, since it didn't change.
            respond(status, headers);
          } else if (request.method == 'HEAD' && status != 405) {
            respond(status, headers);
          } else {
            requestURL(resourceURI, 'GET', requestHeaders,
              function (status, headers, content) {
                if (request.method == 'HEAD') {
                  respond(status, headers);
                } else if (request.method == 'GET') {
                  respond(status, headers, content);
                }
              }
            );
          }
        }
      );
    }
  }

  this.handle = handle;
}();

exports.Server = Server;
