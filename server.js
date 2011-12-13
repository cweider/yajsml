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
function Server(basePath, isLibrary) {
  this._basePath = basePath;
  this._isLibrary = !!isLibrary;
}
Server.prototype = new function () {
  var fileStatusMessages = {
    403: '403: Access denied.'
  , 404: '404: File not found.'
  , 500: '500: Error reading file.'
  };
  
  function head(path, continuation) {
    fs.stat(path, function (error, stats) {
      var status = 500, headers = {}, content = "";
      if (error) {
        if (error.code == 'ENOENT') {
          status = 404;
        } else if (error.code == 'EACCESS') {
          status = 403;
        } else {
          status = 500;
        }
      } else if (stats.isFile()) {
        status = 200;
        headers['Date'] = (new Date()).toUTCString();
        headers['Last-Modified'] = (new Date(stats.mtime)).toUTCString();
      } else {
        status = 404;
      }
      continuation(status, headers);
    });
  }

  function get(path, continuation) {
    fs.readFile(path, function (error, text) {
      var status = 500, headers = {}, content = undefined;
      if (error) {
        if (error.code == 'ENOENT') {
          status = 404;
        } else if (error.code == 'EACCESS') {
          status = 403;
        } else {
          status = 500;
        }
        headers['Content-Type'] = 'text/plain; charset=utf-8';
        continuation(status, headers, fileStatusMessages[status]);
      } else {
        status = 200;
        content = text;
        headers['Content-Type'] = 'application/javascript; charset=utf-8';
        continuation(status, headers, content);
      }
    });
  }

  function handle(request, response) {
    var url = require('url').parse(request.url, true);
    var path = pathutil.normalize(pathutil.join(this._basePath, url.pathname));

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

      var modulePath = pathutil.normalize(url.pathname);
      if (this._isLibrary) {
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
      response.write("405: Only HEAD or GET method are allowed.")
      response.end();
    } else {
      head(path, function (status, headers, content) {
        var modifiedSince = request.headers['if-modified-since'];
        var modifiedLast = headers['Last-Modified'];
        if ((modifiedSince && modifiedLast)
            && (new Date(modifiedSince) >= new Date(modifiedLast))) {
          response.writeHead(304, headers);
          response.end();
        } else if (status == 200) {
          if (request.method == 'HEAD') {
            respond(status, headers);
          } else if (request.method == 'GET') {
            get(path, function (status, headers2, content) {
              respond(status, mixin(headers, headers2), content);
            });
          }
        } else {
          if (request.method == 'HEAD') {
            respond(status, headers);
          } else if (request.method == 'GET') {
            respond(status, headers, content);
          }
        }
      });
    }
  }

  this.handle = handle;
}();

exports.Server = Server;
