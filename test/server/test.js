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

var http = require('http');
var pathutil = require('path');
var urlutil = require('url');
var fs = require('fs');

var args = process.argv.slice(2);
if (args.length != 3) {
  console.error("Arguments: root, lib, test");
  process.exit(1);
}
var rootPath = args[0];
var libraryPath = args[1];
var testFile = args[2]

var Server = require('../../server').Server;
var virtualPaths = {
  '/root': new Server(rootPath, false)
, '/library': new Server(libraryPath, true)
};

var handler = function (request, response) { setTimeout(function () {
  console.log(request.url);

  var url = urlutil.parse(request.url, true);
  var requestPath = pathutil.normalize(url.pathname);
  var path;
  var basePath;
  var realPath;
  var virtualPath;
  for (virtualPath in virtualPaths) {
    if (Object.prototype.hasOwnProperty.call(virtualPaths, virtualPath)) {
      var testPath = requestPath.slice(0, virtualPath.length);
      if (testPath == virtualPath) {
        break;
      } else {
        virtualPath = undefined;
      }
    }
  }

  if (virtualPath) {
    url.pathname = url.pathname.slice(virtualPath.length);
    request.url = urlutil.format(url);
    var writeHead = response.writeHead;
    response.writeHead = function (status, headers) {
      headers['Access-Control-Allow-Origin'] = '*';
      response.writeHead = writeHead;
      response.writeHead(status, headers);
    };
    virtualPaths[virtualPath].handle(request, response);
  } else {
    var path;
    var prefix = '';
    if (requestPath == '/index.html') {
      path = pathutil.join(__dirname, './index.html');
    } else if (requestPath == '/kernel.js') {
      prefix = 'var require = ';
      path = pathutil.join(__dirname, './../../kernel.js');
    } else if (requestPath == '/test.js') {
      path = testFile;
    }

    if (!path) {
      response.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8'
      });
      response.end("404: File not found.");
    } else {
      fs.readFile(path, 'utf8', function (error, text) {
        types = {
          '.html': 'text/html'
        , '.js': 'application/javascript'
        };
        response.writeHead(200, {
          'Content-Type':
            (types[pathutil.extname(path)] || 'text/plain') + '; charset=utf-8'
        });
        prefix && response.write(prefix, 'utf8');
        response.end(text);
      });
    }
  }
}, 100)};

http.createServer(handler).listen(8124);
http.createServer(handler).listen(8125);
http.createServer(handler).listen(8126);

console.log('http://localhost:' + 8124 + '/index.html');
