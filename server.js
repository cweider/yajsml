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

/*
  I implement a JavaScript module server.

  Module associations:
  Packages have many modules and modules can have many Packages. However,
  every module can have at most one 'designated' package. Any requests for a
  module with a designated package will be fullfilled with the contents of
  that package (typically through redirection).
*/

var fs_client = (new function () {
  var STATUS_MESSAGES = {
    403: '403: Access denied.'
  , 404: '404: File not found.'
  , 405: '405: Only the HEAD or GET methods are allowed.'
  , 500: '500: Error reading file.'
  };

  function request(options, callback) {
    var path = options.path;
    var method = options.method;

    var response = new (require('events').EventEmitter);
    response.setEncoding = function (encoding) {this._encoding = encoding};
    response.statusCode = 504;
    response.headers = {};

    var request = new (require('events').EventEmitter);
    request.end = function () {
      if (options.method != 'HEAD' && options.method != 'GET') {
        response.statusCode = 405;
        response.headers['Allow'] = 'HEAD, GET';

        callback(response);
        response.emit('data', STATUS_MESSAGES[response.statusCode])
        response.emit('end');
      } else {
        fs.stat(path, function (error, stats) {
          if (error) {
            if (error.code == 'ENOENT') {
              response.StatusCode = 404;
            } else if (error.code == 'EACCESS') {
              response.StatusCode = 403;
            } else {
              response.StatusCode = 502;
            }
          } else if (stats.isFile()) {
            var date = new Date()
            var modifiedLast = new Date(stats.mtime);
            var modifiedSince = (options.headers || {})['if-modified-since'];

            response.headers['Date'] = date.toUTCString();
            response.headers['Last-Modified'] = modifiedLast.toUTCString();

            if (modifiedSince && modifiedLast
                && modifiedSince >= modifiedLast) {
              response.StatusCode = 304;
            } else {
              response.statusCode = 200;
            }
          } else {
            response.StatusCode = 404;
          }

          if (method == 'HEAD') {
            callback(response);
            response.emit('end');
          } else if (response.statusCode != 200) {
            response.headers['Content-Type'] = 'text/plain; charset=utf-8';

            callback(response);
            response.emit('data', STATUS_MESSAGES[response.statusCode])
            response.emit('end');
          } else {
            fs.readFile(path, function (error, text) {
              if (error) {
                if (error.code == 'ENOENT') {
                  response.statusCode = 404;
                } else if (error.code == 'EACCESS') {
                  response.statusCode = 403;
                } else {
                  response.statusCode = 502;
                }
                response.headers['Content-Type'] = 'text/plain; charset=utf-8';

                callback(response);
                response.emit('data', STATUS_MESSAGES[response.statusCode])
                response.emit('end');
              } else {
                response.statusCode = 200;
                response.headers['Content-Type'] =
                    'application/javascript; charset=utf-8';

                callback(response);
                response.emit('data', text);
                response.emit('end');
              }
            });
          }
        });
      }
    };
    return request;
  }
  this.request = request;
}());

function requestURL(url, method, headers, callback) {
  var parsedURL = urlutil.parse(url);
  var client = undefined;
  if (parsedURL.protocol == 'file:') {
    client = fs_client;
  } else if (parsedURL.protocol == 'http:') {
    client = require('http');
  } else if (parsedURL.protocol == 'https:') {
    client = require('https');
  }
  if (client) {
    var request = client.request({
      host: parsedURL.host
    , port: parsedURL.port
    , path: parsedURL.path
    , method: method
    , headers: headers
    }, function (response) {
      var buffer = undefined;
      response.setEncoding('utf8');
      response.on('data', function (chunk) {
        buffer = buffer || '';
        buffer += chunk;
      });
      response.on('close', function () {
        callback(502, {});
      });
      response.on('end', function () {
        callback(response.statusCode, response.headers, buffer);
      });
    });
    request.on('error', function () {
      callback(502, {});
    });
    request.end();
  }
}

function validateURI(uri) {
  var parsed = urlutil.parse(uri);
  if (parsed.protocol != 'file:'
      && parsed.protocol != 'http:'
      && parsed.protocol != 'https:') {
    throw "Invalid URI: " + JSON.stringify(uri) + ".";
  }
}

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

    var respond = function (status, headers, content) {
      response.writeHead(status, headers);
      content && response.write(content);
      response.end();
    };

    if ('callback' in url.query) {
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

      respond = (function (respond) {
        return function (status, headers, content) {
          var definition;
          if (request.method == 'GET') {
            if (status == 200) {
              definition =
                'function (require, exports, module) {'
              + ('\n' + content).replace(/\n([^\n])/g, "\n    $1")
              + '  }';
            } else {
              definition = 'null';
            }

            content = "";
            content += JSONPCallback + '({\n';
            content += '  ' + toJSLiteral(modulePath) + ': ' + definition;
            content += '\n});\n';
          }

          headers['Content-Type'] = 'application/javascript; charset=utf-8';
          respond(200, headers, content);
        };
      }(respond));
    }

    if (request.method != 'HEAD' && request.method != 'GET') {
      response.writeHead(405, {'Allow': 'HEAD, GET'});
      response.write("405: Only the HEAD or GET methods are allowed.")
      response.end();
    } else {
      var requestHeaders = {
        'user-agent': 'yajsml'
      , 'accept': '*/*'
      , 'if-modified-since': request.headers['if-modified-since']
      }
      requestURL(resourceURI, 'HEAD', requestHeaders,
        function (status, headers, content) {
          if (status == 304) { // Skip the content, since it didn't change.
            respond(status, headers);
          } else if (request.method == 'HEAD' && status != 405) {
            respond(status, headers);
          } else {
            requestURL(resourceURI, 'GET', requestHeaders,
              function (status, headers, content) {
                var responseHeaders = {
                  'date': headers['date']
                , 'last-modified': headers['last-modified']
                , 'content-type': headers['content-type']
                }
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
